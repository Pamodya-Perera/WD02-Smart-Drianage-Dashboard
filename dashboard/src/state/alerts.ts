import type { AlertEvent, DeviceConfig, Reading } from '../data/types';
import { fmtNum, fmtSigned } from '../lib/format';

/**
 * Turns a stream of readings into discrete alert events by watching for
 * transitions (status change, blockage on/off, rapid rise starting).
 */
export class AlertDeriver {
  private prev: Reading | null = null;
  private rapidActive = false;
  private seq = 0;
  /** Timestamp of the reading where the current status began. */
  statusSince = 0;

  constructor(private cfg: DeviceConfig) {}

  setConfig(cfg: DeviceConfig) {
    this.cfg = cfg;
  }

  push(r: Reading): AlertEvent[] {
    const cfg = this.cfg;
    const prev = this.prev;
    const events: AlertEvent[] = [];
    const make = (kind: AlertEvent['kind'], severity: AlertEvent['severity'], title: string, detail: string) =>
      events.push({ id: `${r.timestamp}-${kind}-${this.seq++}`, timestamp: r.timestamp, kind, severity, title, detail });

    if (!prev) {
      this.statusSince = r.timestamp;
    } else {
      if (prev.status !== r.status) {
        this.statusSince = r.timestamp;
        const level = `${fmtNum(r.waterLevel)} cm`;
        if (r.status === 'CRITICAL') {
          const detail =
            r.waterLevel >= cfg.criticalLevel
              ? `Water at ${level} has passed the ${cfg.criticalLevel} cm critical line.`
              : `Water at ${level} is above the warning line and rising ${fmtNum(r.riseRate)} cm/min.`;
          make('status', 'critical', 'Critical water level', detail);
        } else if (r.status === 'WARNING') {
          if (prev.status === 'NORMAL') {
            make('status', 'warning', 'Warning: water is high', `Water at ${level}, ${fmtSigned(r.riseRate)} cm/min.`);
          } else {
            make('status', 'info', 'Eased from critical to warning', `Water at ${level}, ${fmtSigned(r.riseRate)} cm/min.`);
          }
        } else {
          make('status', 'info', 'Back to normal', `Water at ${level}.`);
        }
      }

      if (!prev.blockage && r.blockage) {
        make(
          'blockage',
          'warning',
          'Possible drainage blockage',
          `Water is holding at ${fmtNum(r.waterLevel)} cm after the rain stopped (${fmtSigned(r.riseRate)} cm/min).`,
        );
      } else if (prev.blockage && !r.blockage) {
        make('blockage', 'info', 'Blockage cleared', `Water has dropped to ${fmtNum(r.waterLevel)} cm.`);
      }
    }

    if (!this.rapidActive && r.riseRate >= cfg.rapidRiseRate) {
      this.rapidActive = true;
      make(
        'rapid-rise',
        'warning',
        'Rapid water-level rise',
        `Rising ${fmtNum(r.riseRate)} cm/min at ${fmtNum(r.waterLevel)} cm. Limit is ${cfg.rapidRiseRate} cm/min.`,
      );
    } else if (this.rapidActive && r.riseRate < cfg.rapidRiseRate * 0.6) {
      this.rapidActive = false;
    }

    this.prev = r;
    return events;
  }
}
