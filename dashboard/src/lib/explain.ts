import type { DeviceConfig, Reading } from '../data/types';
import { fmtNum } from './format';

/**
 * Plain-language reason for the current status. The ESP32 decides the status;
 * this only describes which readings explain it.
 */
export function explainStatus(r: Reading, cfg: DeviceConfig): string {
  const level = `${fmtNum(r.waterLevel)} cm`;
  const rate = `${fmtNum(Math.abs(r.riseRate))} cm/min`;

  if (r.status === 'CRITICAL') {
    if (r.waterLevel >= cfg.criticalLevel) {
      return `Water at ${level} has passed the ${cfg.criticalLevel} cm critical line.`;
    }
    return `Water at ${level} is above the warning line and rising ${rate}, faster than the ${cfg.rapidRiseRate} cm/min limit.`;
  }

  if (r.status === 'WARNING') {
    if (r.blockage) return `Water at ${level} is not draining even though the rain has stopped.`;
    if (r.waterLevel >= cfg.warningLevel) {
      return `Water at ${level} is above the ${cfg.warningLevel} cm warning line.`;
    }
    return `Water is rising ${rate}, faster than the ${cfg.rapidRiseRate} cm/min limit.`;
  }

  const margin = fmtNum(cfg.warningLevel - r.waterLevel);
  const rain = r.rainDetected ? ' Rain is being detected.' : '';
  return `Water at ${level}, ${margin} cm below the warning line.${rain}`;
}

/** Minutes since the rain sensor last reported rain, or null if it never has. */
export function minutesSinceRain(history: Reading[], latest: Reading): number | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].rainDetected) return Math.max(0, (latest.timestamp - history[i].timestamp) / 60000);
  }
  return null;
}
