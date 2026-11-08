import { simulator, TICK_MS } from '../sim/engine';
import type { DataSource } from './types';

export function createMockSource(): DataSource {
  return {
    name: 'mock',
    expectedIntervalMs: TICK_MS,
    getConfig: async () => simulator.getConfig(),
    subscribeLatest: (cb) => simulator.subscribe(cb),
    subscribeHistory: (sinceMs, cb) => {
      cb(simulator.getBackfill().filter((r) => r.timestamp >= sinceMs));
      return () => {};
    },
  };
}
