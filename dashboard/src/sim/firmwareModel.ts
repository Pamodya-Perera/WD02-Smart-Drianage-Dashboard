import type { DeviceConfig, Reading, Status } from '../data/types';

interface Sample {
  t: number;
  level: number;
}

/**
 * A software copy of what the ESP32 firmware decides: rise rate from a short
 * window of samples, Normal/Warning/Critical with hysteresis, and the
 * "possible drainage blockage" rule. The simulator and the seeded history both
 * run through it so they behave like real device output.
 */
export class FirmwareModel {
  private samples: Sample[] = [];
  private status: Status = 'NORMAL';
  private blockage = false;
  private dryForMs = 0;
  private lastT: number | null = null;

  constructor(private cfg: DeviceConfig) {}

  update(t: number, rawLevel: number, rainDetected: boolean, temperature: number): Reading {
    const cfg = this.cfg;
    const level = Math.max(0, Math.min(cfg.drainDepth, rawLevel));
    const dt = this.lastT === null ? 0 : t - this.lastT;
    this.lastT = t;

    this.samples.push({ t, level });
    const stepMs = this.samples.length > 1 ? (t - this.samples[0].t) / (this.samples.length - 1) : 0;
    const windowMs = Math.max(60_000, stepMs * 4);
    while (this.samples.length > 3 && t - this.samples[0].t > windowMs) this.samples.shift();

    const riseRate = this.slope();

    this.dryForMs = rainDetected ? 0 : this.dryForMs + dt;
    this.blockage = this.nextBlockage(level, riseRate, rainDetected);
    this.status = this.nextStatus(level, riseRate);

    return {
      waterLevel: round1(level),
      distance: round1(cfg.sensorHeight - level),
      rainDetected,
      temperature: round1(temperature),
      riseRate: round1(riseRate),
      status: this.status,
      blockage: this.blockage,
      timestamp: Math.round(t),
    };
  }

  /** Least-squares slope over the sample window, in cm/min. */
  private slope(): number {
    const n = this.samples.length;
    if (n < 3) return 0;
    const t0 = this.samples[0].t;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const s of this.samples) {
      const x = (s.t - t0) / 60000;
      sx += x;
      sy += s.level;
      sxx += x * x;
      sxy += x * s.level;
    }
    const denom = n * sxx - sx * sx;
    return denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  }

  private nextBlockage(level: number, rate: number, rain: boolean): boolean {
    const cfg = this.cfg;
    if (this.blockage) {
      const draining = rate < -0.6;
      const cleared = level < cfg.blockageLevel - 2;
      return !(rain || draining || cleared);
    }
    const dryLongEnough = this.dryForMs >= cfg.blockageHoldMin * 60_000;
    return dryLongEnough && level >= cfg.blockageLevel && rate > -0.3;
  }

  private nextStatus(level: number, rate: number): Status {
    const cfg = this.cfg;
    const rapid = rate >= cfg.rapidRiseRate;
    // Step down only once the level is clearly below a line, so it doesn't flicker.
    const hold = (line: number, was: boolean) => (was ? line - 1.5 : line);

    const wasCritical = this.status === 'CRITICAL';
    const wasAlert = this.status !== 'NORMAL';

    if (level >= hold(cfg.criticalLevel, wasCritical)) return 'CRITICAL';
    if (rapid && level >= cfg.warningLevel) return 'CRITICAL';
    if (level >= hold(cfg.warningLevel, wasAlert)) return 'WARNING';
    if (rapid && level >= 15) return 'WARNING';
    if (this.blockage) return 'WARNING';
    return 'NORMAL';
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;
