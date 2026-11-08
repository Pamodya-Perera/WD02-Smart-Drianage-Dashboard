import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createDataSource } from '../data';
import { DEFAULT_CONFIG, DEVICE, HISTORY_WINDOW_MS, MAX_HISTORY_POINTS } from '../data/site';
import type { AlertEvent, DataSource, DeviceConfig, DeviceInfo, Reading } from '../data/types';
import { fmtDuration } from '../lib/format';
import { AlertDeriver } from './alerts';
import {
  askPermission,
  currentPermission,
  readMuted,
  shouldNotify,
  showSystemNotification,
  writeMuted,
  type PermissionState,
} from './notifications';

export type ConnectionState = 'connecting' | 'live' | 'offline';

export interface DashboardValue {
  ready: boolean;
  error: string | null;
  sourceName: 'mock' | 'firebase';
  device: DeviceInfo;
  config: DeviceConfig;
  latest: Reading | null;
  history: Reading[];
  alerts: AlertEvent[];
  statusSince: number | null;
  connection: ConnectionState;
  /** Wall-clock ms when the last reading arrived. */
  lastReceivedAt: number | null;
  readingsReceived: number;
  sessionStart: number;
  expectedIntervalMs: number;
  toasts: AlertEvent[];
  dismissToast: (id: string) => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
  permission: PermissionState;
  requestPermission: () => void;
}

const Ctx = createContext<DashboardValue | null>(null);

export function useDashboard(): DashboardValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDashboard must be used inside <DashboardProvider>');
  return v;
}

const MAX_ALERTS = 500;
const OFFLINE_AFTER_INTERVALS = 3;

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<DataSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<DeviceConfig>(DEFAULT_CONFIG);
  const [latest, setLatest] = useState<Reading | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [statusSince, setStatusSince] = useState<number | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);
  const [readingsReceived, setReadingsReceived] = useState(0);
  const [toasts, setToasts] = useState<AlertEvent[]>([]);
  const [muted, setMutedState] = useState(readMuted);
  const [permission, setPermission] = useState<PermissionState>(currentPermission);

  const sessionStart = useRef(Date.now()).current;
  const deriver = useRef<AlertDeriver | null>(null);
  const lastReceivedRef = useRef<number | null>(null);
  const lastReadingTs = useRef<number | null>(null);
  const wasOffline = useRef(false);
  const offlineSince = useRef<number | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Create the data source once.
  useEffect(() => {
    let cancelled = false;
    createDataSource()
      .then((s) => {
        if (!cancelled) setSource(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pushAlerts = useCallback((events: AlertEvent[], live: boolean) => {
    if (events.length === 0) return;
    setAlerts((prev) => [...events.slice().reverse(), ...prev].slice(0, MAX_ALERTS));
    if (!live) return;
    const loud = events.filter(shouldNotify);
    if (loud.length === 0 || mutedRef.current) return;
    setToasts((prev) => [...loud, ...prev].slice(0, 3));
    loud.forEach((e) => showSystemNotification(e, DEVICE.name));
  }, []);

  // Subscribe to config, history and live readings.
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    let unsubLatest = () => {};
    let unsubHistory = () => {};

    source.getConfig().then((cfg) => {
      if (cancelled) return;
      setConfig(cfg);
      const d = new AlertDeriver(cfg);
      deriver.current = d;

      let seeded = false;
      unsubHistory = source.subscribeHistory(Date.now() - HISTORY_WINDOW_MS, (rows) => {
        if (cancelled) return;
        setHistory(rows);
        if (!seeded) {
          // Rebuild the alert log from stored history so the Alerts view isn't empty on load.
          seeded = true;
          const seedDeriver = new AlertDeriver(cfg);
          const seededEvents: AlertEvent[] = [];
          for (const r of rows) seededEvents.push(...seedDeriver.push(r));
          setAlerts(seededEvents.reverse().slice(0, MAX_ALERTS));
          deriver.current = seedDeriver;
          setStatusSince(seedDeriver.statusSince || null);
          const lastRow = rows[rows.length - 1];
          if (lastRow) lastReadingTs.current = lastRow.timestamp;
        }
      });

      unsubLatest = source.subscribeLatest((r) => {
        if (cancelled) return;
        const wall = Date.now();
        lastReceivedRef.current = wall;
        setLastReceivedAt(wall);
        setReadingsReceived((n) => n + 1);
        setLatest(r);

        if (wasOffline.current) {
          wasOffline.current = false;
          const downFor = offlineSince.current === null ? 0 : wall - offlineSince.current;
          offlineSince.current = null;
          setConnection('live');
          pushAlerts(
            [
              {
                id: `${r.timestamp}-connection-up`,
                timestamp: r.timestamp,
                kind: 'connection',
                severity: 'info',
                title: 'Connection restored',
                detail: `Device is sending data again after ${fmtDuration(downFor)} offline.`,
              },
            ],
            true,
          );
        } else {
          setConnection('live');
        }

        if (lastReadingTs.current === null || r.timestamp > lastReadingTs.current) {
          lastReadingTs.current = r.timestamp;
          setHistory((prev) => {
            const next = prev.length >= MAX_HISTORY_POINTS ? prev.slice(prev.length - MAX_HISTORY_POINTS + 1) : prev.slice();
            next.push(r);
            return next;
          });
          const dv = deriver.current;
          if (dv) {
            pushAlerts(dv.push(r), true);
            setStatusSince(dv.statusSince);
          }
        }
      });
    });

    return () => {
      cancelled = true;
      unsubLatest();
      unsubHistory();
    };
  }, [source, pushAlerts]);

  // Offline watchdog.
  useEffect(() => {
    if (!source) return;
    const limit = source.expectedIntervalMs * OFFLINE_AFTER_INTERVALS;
    const id = window.setInterval(() => {
      const last = lastReceivedRef.current;
      if (last === null || wasOffline.current) return;
      if (Date.now() - last > limit) {
        wasOffline.current = true;
        offlineSince.current = last;
        setConnection('offline');
        const ts = lastReadingTs.current ?? Date.now();
        pushAlerts(
          [
            {
              id: `${ts}-connection-down-${last}`,
              timestamp: ts,
              kind: 'connection',
              severity: 'warning',
              title: 'Connection lost',
              detail: `No data received for more than ${fmtDuration(limit)}. Readings shown are the last known values.`,
            },
          ],
          true,
        );
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [source, pushAlerts]);

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((e) => e.id !== id)), []);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    writeMuted(m);
  }, []);

  const requestPermission = useCallback(() => {
    askPermission().then(setPermission);
  }, []);

  const value = useMemo<DashboardValue>(
    () => ({
      ready: source !== null,
      error,
      sourceName: source?.name ?? 'mock',
      device: DEVICE,
      config,
      latest,
      history,
      alerts,
      statusSince,
      connection,
      lastReceivedAt,
      readingsReceived,
      sessionStart,
      expectedIntervalMs: source?.expectedIntervalMs ?? 2000,
      toasts,
      dismissToast,
      muted,
      setMuted,
      permission,
      requestPermission,
    }),
    [
      source,
      error,
      config,
      latest,
      history,
      alerts,
      statusSince,
      connection,
      lastReceivedAt,
      readingsReceived,
      sessionStart,
      toasts,
      dismissToast,
      muted,
      setMuted,
      permission,
      requestPermission,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
