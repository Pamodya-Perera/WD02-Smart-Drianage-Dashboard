import { DEFAULT_CONFIG, HISTORY_WINDOW_MS } from '../data/site';
import type { DeviceConfig, Reading } from '../data/types';
import { FirmwareModel } from './firmwareModel';
import { SCENARIOS, type Phase, type Scenario } from './scenarios';

export const TICK_MS = 2000;
export const SPEED_OPTIONS = [1, 5, 20] as const;

// Drain physics, in cm and seconds. Level changes by inflow minus outflow.
const OUTFLOW_COEFF = 0.004; // cm/s per sqrt(cm) of depth when fully open
const BASE_INFLOW = 0.0106; // dry-weather flow, holds the level near 7 cm
const RAIN_GAIN = 0.06; // cm/s at full intensity (scaled by intensity squared)
const SENSOR_NOISE_CM = 0.1;

export interface SimSnapshot {
  speed: number;
  scenarioId: string;
  phaseLabel: string;
  phaseIndex: number;
  phaseCount: number;
  phaseRemainingS: number;
  rain: number;
  open: number;
  offlineRemainingS: number;
  level: number;
}

type Listener = (r: Reading) => void;
type StateListener = (s: SimSnapshot) => void;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function stepLevel(level: number, rain: number, open: number, seconds: number, depth: number) {
  const inflow = BASE_INFLOW + RAIN_GAIN * rain * rain;
  const outflow = OUTFLOW_COEFF * open * Math.sqrt(Math.max(level, 0));
  return Math.min(depth, Math.max(0, level + (inflow - outflow) * seconds));
}

const diurnalTemp = (ts: number) => {
  const d = new Date(ts);
  const hour = d.getHours() + d.getMinutes() / 60;
  return 27.5 + 3.5 * Math.sin(((hour - 9) / 24) * 2 * Math.PI);
};

interface Storm {
  hoursAgo: number;
  minutes: number;
  rain: number;
  /** Drain capacity during and after the storm. */
  open: number;
  /** Extra minutes the restriction lasts after rain stops. */
  restrictedAfterMin?: number;
}

const PAST_STORMS: Storm[] = [
  { hoursAgo: 6.3 * 24, minutes: 40, rain: 0.5, open: 1 },
  { hoursAgo: 4.8 * 24, minutes: 90, rain: 0.95, open: 1 },
  { hoursAgo: 3.1 * 24, minutes: 25, rain: 0.35, open: 1 },
  { hoursAgo: 1.6 * 24, minutes: 12, rain: 0.7, open: 0.45, restrictedAfterMin: 45 },
  { hoursAgo: 5.5, minutes: 35, rain: 0.6, open: 1 },
];

export class Simulator {
  private listeners = new Set<Listener>();
  private stateListeners = new Set<StateListener>();
  private timer: number | null = null;
  private cfg: DeviceConfig = DEFAULT_CONFIG;
  private firmware: FirmwareModel;
  private rand = mulberry32(20260508);

  private clock = Date.now();
  private level = 7;
  private rain = 0;
  private open = 1;
  private speed = 5;

  private scenario: Scenario = SCENARIOS[0];
  private phaseIndex = 0;
  private phaseElapsed = 0;
  private offlineUntil = 0;
  private hasEmitted = false;

  private backfill: Reading[] = [];
  private latest: Reading | null = null;

  constructor() {
    this.firmware = new FirmwareModel(this.cfg);
    this.buildBackfill();

    // Demo links: /?scenario=heavy-rain&speed=20 starts a scenario on load.
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search);
      const speed = Number(q.get('speed'));
      if ((SPEED_OPTIONS as readonly number[]).includes(speed)) this.speed = speed;
      const id = q.get('scenario');
      if (id && SCENARIOS.some((s) => s.id === id)) this.runScenario(id);
    }
  }

  getConfig(): DeviceConfig {
    return this.cfg;
  }

  getBackfill(): Reading[] {
    return this.backfill;
  }

  /** Subscribing starts the clock; the last unsubscribe stops it. */
  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    if (this.latest) cb(this.latest);
    this.start();
    return () => {
      this.listeners.delete(cb);
      if (this.listeners.size === 0) this.stop();
    };
  }

  subscribeState(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    cb(this.snapshot());
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.emitState();
  }

  runScenario(id: string) {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) return;
    this.scenario = scenario;
    this.phaseIndex = 0;
    this.phaseElapsed = 0;
    this.applyPhase(scenario.phases[0]);
    if (scenario.wifiDropSeconds) this.offlineUntil = Date.now() + scenario.wifiDropSeconds * 1000;
    this.emitState();
  }

  /** Jump the water to a level, as if it had just risen or fallen there. */
  setLevel(level: number) {
    this.level = Math.max(0, Math.min(this.cfg.drainDepth, level));
    this.emitState();
  }

  private start() {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private stop() {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }

  private applyPhase(p: Phase) {
    this.rain = p.rain;
    this.open = p.open;
  }

  private advanceScenario(seconds: number) {
    const phases = this.scenario.phases;
    this.phaseElapsed += seconds;
    while (this.phaseIndex < phases.length && this.phaseElapsed >= phases[this.phaseIndex].seconds) {
      this.phaseElapsed -= phases[this.phaseIndex].seconds;
      this.phaseIndex += 1;
      if (this.phaseIndex < phases.length) {
        this.applyPhase(phases[this.phaseIndex]);
      } else {
        // Scenario finished: the weather clears and the drain reopens.
        this.scenario = SCENARIOS[0];
        this.phaseIndex = 0;
        this.phaseElapsed = 0;
        this.applyPhase(SCENARIOS[0].phases[0]);
        return;
      }
    }
  }

  private tick() {
    const simSeconds = (TICK_MS / 1000) * this.speed;
    let remaining = simSeconds;
    while (remaining > 0) {
      const h = Math.min(remaining, 5);
      this.level = stepLevel(this.level, this.rain, this.open, h, this.cfg.drainDepth);
      this.advanceScenario(h);
      remaining -= h;
    }
    this.clock += simSeconds * 1000;

    const noisy = this.level + gaussian(this.rand) * SENSOR_NOISE_CM;
    const reading = this.firmware.update(this.clock, noisy, this.rain > 0.05, diurnalTemp(this.clock));
    this.latest = reading;

    // A Wi-Fi drop silences the device, but never before its first packet.
    if (!this.hasEmitted || Date.now() >= this.offlineUntil) {
      this.hasEmitted = true;
      for (const cb of this.listeners) cb(reading);
    }
    this.emitState();
  }

  private snapshot(): SimSnapshot {
    const phase = this.scenario.phases[Math.min(this.phaseIndex, this.scenario.phases.length - 1)];
    return {
      speed: this.speed,
      scenarioId: this.scenario.id,
      phaseLabel: phase.label,
      phaseIndex: this.phaseIndex,
      phaseCount: this.scenario.phases.length,
      phaseRemainingS: Math.max(0, phase.seconds - this.phaseElapsed),
      rain: this.rain,
      open: this.open,
      offlineRemainingS: Math.max(0, Math.ceil((this.offlineUntil - Date.now()) / 1000)),
      level: this.level,
    };
  }

  private emitState() {
    const s = this.snapshot();
    for (const cb of this.stateListeners) cb(s);
  }

  /** Seven days of past readings at 2-minute spacing, with a few storms in them. */
  private buildBackfill() {
    const stepMs = 2 * 60 * 1000;
    const end = this.clock;
    const start = end - HISTORY_WINDOW_MS;
    const model = new FirmwareModel(this.cfg);
    const rand = mulberry32(7);
    const out: Reading[] = [];

    let level = 7;
    for (let t = start; t < end; t += stepMs) {
      let rain = 0;
      let open = 1;
      for (const s of PAST_STORMS) {
        const stormStart = end - s.hoursAgo * 3600_000;
        const stormEnd = stormStart + s.minutes * 60_000;
        const restrictedEnd = stormEnd + (s.restrictedAfterMin ?? 0) * 60_000;
        if (t >= stormStart && t < stormEnd) {
          const ramp = Math.min(1, (t - stormStart) / 240_000);
          const fade = Math.min(1, (stormEnd - t) / 240_000);
          rain = s.rain * Math.min(ramp, fade);
          open = s.open;
        } else if (t >= stormEnd && t < restrictedEnd) {
          open = s.open;
        }
      }
      // 120 s per step, integrated in 20 s slices
      for (let i = 0; i < 6; i++) level = stepLevel(level, rain, open, 20, this.cfg.drainDepth);
      const noisy = level + gaussian(rand) * SENSOR_NOISE_CM;
      out.push(model.update(t, noisy, rain > 0.05, diurnalTemp(t)));
    }

    this.backfill = out;
    this.level = level;
    // Hand the live model the same state so status and blockage carry over cleanly.
    this.firmware = model;
  }
}

export const simulator = new Simulator();
