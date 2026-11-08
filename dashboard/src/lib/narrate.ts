import type { DeviceConfig, Reading } from '../data/types';
import { fmtDuration, fmtNum } from './format';

export interface Narration {
  headline: string;
  detail: string;
}

/**
 * Says what the drain is doing in the words a person would use. The ESP32 decides
 * the status; this only describes it.
 */
export function narrate(r: Reading, cfg: DeviceConfig, sinceRainMin: number | null): Narration {
  const level = fmtNum(r.waterLevel, 1);
  const toWarn = Math.max(0, cfg.warningLevel - r.waterLevel);
  const toCrit = Math.max(0, cfg.criticalLevel - r.waterLevel);
  const rate = Math.abs(r.riseRate);

  if (r.status === 'CRITICAL') {
    if (r.waterLevel >= cfg.criticalLevel) {
      const brimming = r.waterLevel >= cfg.drainDepth * 0.95;
      return {
        headline: brimming ? 'The drain is full.' : 'Water is past the critical line.',
        detail: `Water is at ${level} cm, ${fmtNum(r.waterLevel - cfg.criticalLevel)} cm over the ${cfg.criticalLevel} cm limit and ${fmtNum(cfg.drainDepth - r.waterLevel)} cm from the top. This needs someone on site now.`,
      };
    }
    return {
      headline: 'Water is climbing fast.',
      detail: `${level} cm and rising ${fmtNum(rate)} cm/min. At this speed it reaches the critical line in about ${etaMinutes(toCrit, rate)}.`,
    };
  }

  if (r.status === 'WARNING') {
    if (r.blockage) {
      const stopped = sinceRainMin !== null && sinceRainMin >= 1 ? `Rain stopped ${Math.round(sinceRainMin)} minutes ago` : 'The rain has stopped';
      return {
        headline: "The drain isn't emptying.",
        detail: `${stopped}, but water is still at ${level} cm and not falling. Something may be blocking it.`,
      };
    }
    if (r.waterLevel >= cfg.warningLevel) {
      return {
        headline: 'Water is getting high.',
        detail: `${level} cm, ${fmtNum(toCrit)} cm below the critical line${r.riseRate >= 0.3 ? ` and still rising ${fmtNum(rate)} cm/min` : ''}.`,
      };
    }
    return {
      headline: 'Water is rising quickly.',
      detail: `Only ${level} cm so far, but it is gaining ${fmtNum(rate)} cm every minute, faster than the ${cfg.rapidRiseRate} cm/min limit.`,
    };
  }

  if (r.rainDetected) {
    return {
      headline: 'Raining, and the drain is coping.',
      detail: `Water is at ${level} cm, ${fmtNum(toWarn)} cm below the warning line${trendWord(r.riseRate)}.`,
    };
  }

  const dry = sinceRainMin !== null ? ` No rain for ${fmtDuration(sinceRainMin * 60000)}.` : '';
  return {
    headline: 'All quiet.',
    detail: `Water is ${level} cm deep, ${fmtNum(toWarn)} cm below the warning line${trendWord(r.riseRate)}.${dry}`,
  };
}

function trendWord(rate: number): string {
  if (rate >= 0.3) return ' and creeping up';
  if (rate <= -0.3) return ' and falling';
  return ' and holding steady';
}

function etaMinutes(remainingCm: number, rate: number): string {
  if (rate <= 0) return 'an unknown time';
  const m = remainingCm / rate;
  if (m < 1) return 'under a minute';
  return `${Math.round(m)} minute${Math.round(m) === 1 ? '' : 's'}`;
}
