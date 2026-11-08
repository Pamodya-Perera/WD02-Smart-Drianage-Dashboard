import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  onValue,
  orderByChild,
  query,
  ref,
  startAt,
  type DataSnapshot,
} from 'firebase/database';
import { DEFAULT_CONFIG, DEVICE } from './site';
import type { DataSource, DeviceConfig, Reading, Status } from './types';

const STATUSES: Status[] = ['NORMAL', 'WARNING', 'CRITICAL'];

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Tolerant parser: the ESP32 firmware may send seconds instead of milliseconds,
 * omit the timestamp, or use lower-case status strings.
 */
export function parseReading(raw: unknown, cfg: DeviceConfig): Reading | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.waterLevel === undefined && o.distance === undefined) return null;

  const distance = num(o.distance, NaN);
  const waterLevel = o.waterLevel !== undefined ? num(o.waterLevel) : Math.max(0, cfg.sensorHeight - distance);

  let timestamp = num(o.timestamp, 0);
  if (timestamp <= 0) timestamp = Date.now();
  else if (timestamp < 1e11) timestamp *= 1000;

  const status = String(o.status ?? 'NORMAL').toUpperCase() as Status;

  return {
    waterLevel,
    distance: Number.isFinite(distance) ? distance : cfg.sensorHeight - waterLevel,
    rainDetected: o.rainDetected === true || o.rainDetected === 1 || o.rainDetected === 'true',
    temperature: num(o.temperature),
    riseRate: num(o.riseRate),
    status: STATUSES.includes(status) ? status : 'NORMAL',
    blockage: o.blockage === true || o.blockage === 1 || o.blockage === 'true',
    timestamp,
  };
}

export function createFirebaseSource(): DataSource {
  const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    throw new Error('VITE_FIREBASE_DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }

  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  const db = getDatabase(app);
  const base = `devices/${DEVICE.id}`;

  let cfg = DEFAULT_CONFIG;

  return {
    name: 'firebase',
    expectedIntervalMs: 5000,

    getConfig: () =>
      new Promise<DeviceConfig>((resolve) => {
        onValue(
          ref(db, `${base}/config`),
          (snap) => {
            const v = snap.val() as Partial<DeviceConfig> | null;
            cfg = { ...DEFAULT_CONFIG, ...(v ?? {}) };
            resolve(cfg);
          },
          () => resolve(cfg),
          { onlyOnce: true },
        );
      }),

    subscribeLatest: (cb) =>
      onValue(ref(db, `${base}/latest`), (snap: DataSnapshot) => {
        const r = parseReading(snap.val(), cfg);
        if (r) cb(r);
      }),

    // Needs ".indexOn": "timestamp" under /devices/<id>/history in the database rules.
    subscribeHistory: (sinceMs, cb) =>
      onValue(query(ref(db, `${base}/history`), orderByChild('timestamp'), startAt(sinceMs)), (snap) => {
        const out: Reading[] = [];
        snap.forEach((child) => {
          const r = parseReading(child.val(), cfg);
          if (r) out.push(r);
        });
        out.sort((a, b) => a.timestamp - b.timestamp);
        cb(out);
      }),
  };
}
