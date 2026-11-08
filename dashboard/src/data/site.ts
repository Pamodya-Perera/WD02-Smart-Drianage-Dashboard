import type { DeviceConfig, DeviceInfo } from './types';

export const DEVICE: DeviceInfo = {
  id: import.meta.env.VITE_DEVICE_ID || 'drain-01',
  name: 'Drain 01',
  location: 'Prototype drainage model, SLIIT Malabe',
};

/**
 * Fallback thresholds. The real values come from /devices/<id>/config when the
 * ESP32 publishes it; these keep the dashboard usable until then.
 */
export const DEFAULT_CONFIG: DeviceConfig = {
  warningLevel: 30,
  criticalLevel: 45,
  rapidRiseRate: 2,
  drainDepth: 60,
  sensorHeight: 70,
  blockageLevel: 20,
  blockageHoldMin: 5,
};

export const HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_HISTORY_POINTS = 12000;
