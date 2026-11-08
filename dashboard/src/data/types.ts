export type Status = 'NORMAL' | 'WARNING' | 'CRITICAL';

/** One packet from the ESP32. Field names match the Firebase data contract. */
export interface Reading {
  /** Water depth in the drain, cm (sensor height minus measured distance). */
  waterLevel: number;
  /** Raw ultrasonic distance from sensor to water surface, cm. */
  distance: number;
  rainDetected: boolean;
  /** Ambient temperature, °C. */
  temperature: number;
  /** Rate of change of water level, cm/min. Negative while draining. */
  riseRate: number;
  status: Status;
  blockage: boolean;
  /** Epoch milliseconds. */
  timestamp: number;
}

export interface DeviceConfig {
  /** Water level that triggers WARNING, cm. */
  warningLevel: number;
  /** Water level that triggers CRITICAL, cm. */
  criticalLevel: number;
  /** Rise rate counted as "rapid", cm/min. */
  rapidRiseRate: number;
  /** Interior depth of the drain model, cm. */
  drainDepth: number;
  /** Height of the ultrasonic sensor above the drain floor, cm. */
  sensorHeight: number;
  /** Level above which a stalled drain counts as blocked, cm. */
  blockageLevel: number;
  /** Minutes without rain before a high, non-falling level counts as a blockage. */
  blockageHoldMin: number;
}

export interface DeviceInfo {
  id: string;
  name: string;
  location: string;
}

export type AlertKind = 'status' | 'blockage' | 'rapid-rise' | 'connection';
export type Severity = 'info' | 'warning' | 'critical';

export interface AlertEvent {
  id: string;
  timestamp: number;
  kind: AlertKind;
  severity: Severity;
  title: string;
  detail: string;
}

export type Unsubscribe = () => void;

export interface DataSource {
  readonly name: 'mock' | 'firebase';
  /** How often the device is expected to send a reading, ms. */
  readonly expectedIntervalMs: number;
  getConfig(): Promise<DeviceConfig>;
  subscribeLatest(cb: (reading: Reading) => void): Unsubscribe;
  /** Delivers every stored reading since `sinceMs`, oldest first. */
  subscribeHistory(sinceMs: number, cb: (readings: Reading[]) => void): Unsubscribe;
}
