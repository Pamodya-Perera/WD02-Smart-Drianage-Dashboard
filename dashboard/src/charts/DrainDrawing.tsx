import { useId, type ReactNode } from 'react';
import type { DeviceConfig, Reading, Status } from '../data/types';
import { fmtDuration, fmtNum, fmtSigned } from '../lib/format';
import { useSmooth } from '../lib/hooks';
import type { ConnectionState } from '../state/DashboardProvider';
import s from './DrainDrawing.module.css';

interface Props {
  reading: Reading | null;
  config: DeviceConfig;
  connection: ConnectionState;
  /** Minutes since the rain sensor last reported rain. */
  sinceRainMin: number | null;
  /** Seconds between expected readings, for the uplink note. */
  intervalSec: number;
  /** Text for the uplink note while offline, e.g. "12s ago". */
  lastSeen: string | null;
  /** Narrow screens drop the callouts; the page lists the readings instead. */
  compact?: boolean;
}

const W = 1120;
const H = 640;
const GROUND = 260;
const FLOOR = 580;
const INNER_L = 380;
const INNER_R = 780;
const WALL = 34;
const CX = (INNER_L + INNER_R) / 2;
const SLAB = 28; // floor thickness

const LED: Record<Status, number> = { NORMAL: 0, WARNING: 1, CRITICAL: 2 };
const LED_X = [284, 300, 316];
const LED_COLOR = ['var(--ok)', 'var(--warn)', 'var(--crit)'];

/**
 * A section through the prototype drain, drawn like an engineering sheet. The hardware is the
 * real hardware from the proposal, and it shows live state: the LEDs on the ESP32 box light the
 * way the physical ones do, the buzzer sounds at critical, and the water is drawn at true depth.
 */
export function DrainDrawing({ reading, config, connection, sinceRainMin, intervalSec, lastSeen, compact }: Props) {
  const uid = useId().replace(/:/g, '');
  const depth = config.drainDepth;
  const px = (FLOOR - GROUND) / depth;
  const yAt = (cm: number) => FLOOR - cm * px;

  const level = reading ? Math.min(depth, Math.max(0, reading.waterLevel)) : 0;
  const shown = useSmooth(level, 900);
  const waterY = yAt(shown);
  const sensorY = Math.min(yAt(config.sensorHeight), GROUND - 30);

  const status = reading?.status ?? 'NORMAL';
  const offline = connection !== 'live';
  const raining = reading?.rainDetected ?? false;
  const pct = reading ? Math.round((reading.waterLevel / depth) * 100) : 0;

  const ticks: number[] = [];
  for (let v = 0; v <= depth; v += 5) ticks.push(v);

  const viewBox = compact ? '176 44 664 590' : `0 0 ${W} ${H}`;

  // echo cone widens as it travels down
  const cone = (y: number) => 9 + (y - sensorY) * 0.27;

  return (
    <svg
      className={s.drawing}
      viewBox={viewBox}
      role="img"
      aria-label={
        reading
          ? `Section drawing of the drain. Water is ${fmtNum(reading.waterLevel)} centimetres deep of ${depth}. Status ${status.toLowerCase()}.`
          : 'Section drawing of the drain. Waiting for data.'
      }
    >
      <defs>
        <pattern id={`concrete-${uid}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" className={s.hatch} />
        </pattern>
        <clipPath id={`bore-${uid}`}>
          <rect x={INNER_L} y={GROUND} width={INNER_R - INNER_L} height={FLOOR - GROUND} />
        </clipPath>
      </defs>

      {!compact ? <Frame /> : null}

      {/* rain, behind everything */}
      {raining ? <Rain /> : null}

      {/* ground line with section hatching */}
      <line x1={28} x2={INNER_L - WALL} y1={GROUND} y2={GROUND} className={s.ground} />
      <line x1={INNER_R + WALL} x2={W - 28} y1={GROUND} y2={GROUND} className={s.ground} />
      {range(40, 300, 13).map((x) => (
        <line key={`gl${x}`} x1={x} y1={GROUND} x2={x - 9} y2={GROUND + 10} className={s.groundTick} />
      ))}
      {range(INNER_R + WALL + 14, W - 40, 13).map((x) => (
        <line key={`gr${x}`} x1={x} y1={GROUND} x2={x - 9} y2={GROUND + 10} className={s.groundTick} />
      ))}

      {/* the drain: walls and floor in concrete */}
      <path
        d={`M${INNER_L - WALL} ${GROUND}V${FLOOR + SLAB}H${INNER_R + WALL}V${GROUND}H${INNER_R}V${FLOOR}H${INNER_L}V${GROUND}Z`}
        className={s.concrete}
      />
      <path
        d={`M${INNER_L - WALL} ${GROUND}V${FLOOR + SLAB}H${INNER_R + WALL}V${GROUND}H${INNER_R}V${FLOOR}H${INNER_L}V${GROUND}Z`}
        fill={`url(#concrete-${uid})`}
      />

      {/* water, clipped to the bore */}
      <g clipPath={`url(#bore-${uid})`}>
        <g transform={`translate(0 ${waterY})`}>
          <path d={wavePath(INNER_L - 64, INNER_R + 64, 64, 2.4, 420)} className={s.waterBody} />
          <g className={s.drift}>
            <path d={waveLine(INNER_L - 64, INNER_R + 128, 64, 2.4)} className={s.surface} />
          </g>
          {waterTicks(waterY).map((t, i) => (
            <line key={i} x1={t.x} x2={t.x + t.len} y1={t.y} y2={t.y} className={s.waterTick} />
          ))}
        </g>
      </g>

      {/* thresholds across the bore */}
      <Threshold y={yAt(config.warningLevel)} label={`WARNING ${config.warningLevel} cm`} tone="warn" />
      <Threshold y={yAt(config.criticalLevel)} label={`CRITICAL ${config.criticalLevel} cm`} tone="crit" />

      {/* scale along the left wall */}
      {ticks.map((v) => {
        const major = v % 10 === 0;
        return (
          <g key={v}>
            <line x1={INNER_L - WALL - (major ? 12 : 6)} x2={INNER_L - WALL} y1={yAt(v)} y2={yAt(v)} className={major ? s.tickMajor : s.tick} />
            {major ? (
              <text
                x={INNER_L - WALL - 18}
                y={v === depth ? yAt(v) + 13 : yAt(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className={s.tickLabel}
              >
                {v}
              </text>
            ) : null}
          </g>
        );
      })}

      <text x={INNER_L - WALL - 18} y={FLOOR + 18} textAnchor="end" className={s.tickLabel}>
        cm
      </text>

      {/* water-level symbol */}
      <path d={`M${INNER_R - 90} ${waterY - 13}h14l-7 11z`} className={s.wl} />

      {/* chained dimensions: water depth, then echo distance */}
      <Dimension x={INNER_L + 26} y1={waterY} y2={FLOOR} />
      {reading ? (
        <text x={INNER_L + 36} y={(waterY + FLOOR) / 2} dominantBaseline="middle" className={s.dimLabel}>
          {fmtNum(shown)} cm
        </text>
      ) : null}

      <line x1={CX - 14} x2={INNER_L + 78} y1={sensorY} y2={sensorY} className={s.extension} />
      <line x1={CX - cone(waterY)} x2={INNER_L + 78} y1={waterY} y2={waterY} className={s.extension} />
      <Dimension x={INNER_L + 84} y1={sensorY} y2={waterY} />
      {reading ? (
        <text transform={`translate(${INNER_L + 76} ${(sensorY + waterY) / 2}) rotate(-90)`} textAnchor="middle" className={s.dimLabel}>
          {fmtNum(config.sensorHeight - shown)} cm
        </text>
      ) : null}

      {/* echo path */}
      <path d={`M${CX - 9} ${sensorY}L${CX - cone(waterY)} ${waterY}M${CX + 9} ${sensorY}L${CX + cone(waterY)} ${waterY}`} className={s.cone} />
      {[0.25, 0.5, 0.75].map((f) => {
        const y = sensorY + (waterY - sensorY) * f;
        const w = cone(y) * 0.85;
        return <path key={f} d={`M${CX - w} ${y}Q${CX} ${y + w * 0.45} ${CX + w} ${y}`} className={s.echo} />;
      })}

      {/* pole, solar panel, battery */}
      <rect x={294} y={96} width={12} height={GROUND - 96} className={s.solid} />
      <rect x={282} y={GROUND - 6} width={36} height={6} className={s.solid} />
      <g transform="rotate(-9 300 88)">
        <rect x={214} y={84} width={172} height={9} className={s.solid} />
        {range(240, 372, 26).map((x) => (
          <line key={x} x1={x} x2={x} y1={84} y2={93} className={s.cell} />
        ))}
      </g>
      <path d="M270 96L300 90L330 96" className={s.strut} />

      {/* rain sensor board on a short arm */}
      <line x1={294} y1={132} x2={250} y2={132} className={s.arm} />
      <g transform="rotate(-18 236 124)">
        <rect x={218} y={114} width={38} height={20} className={s.solid} />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${222 + i * 8} 118v12`} className={s.trace} />
        ))}
      </g>
      {raining ? <Drops /> : null}

      {/* ESP32 box with the real status LEDs and buzzer */}
      <rect x={266} y={146} width={68} height={68} rx={2} className={s.solid} />
      {LED_X.map((x, i) => {
        const on = !offline && LED[status] === i;
        return (
          <g key={i}>
            {on ? <circle cx={x} cy={164} r={9} fill={LED_COLOR[i]} className={s.glow} /> : null}
            <circle
              cx={x}
              cy={164}
              r={5.5}
              fill={on ? LED_COLOR[i] : 'var(--paper)'}
              stroke={on ? LED_COLOR[i] : 'var(--ink-3)'}
              strokeWidth={1.4}
            />
          </g>
        );
      })}
      <circle cx={300} cy={194} r={9} className={s.buzzer} />
      <circle cx={300} cy={194} r={3.5} className={s.buzzerCore} />
      {!offline && status === 'CRITICAL' ? (
        <g className={s.sound}>
          <path d="M283 186a14 14 0 0 0 0 16" />
          <path d="M277 182a21 21 0 0 0 0 24" />
          <path d="M317 186a14 14 0 0 1 0 16" />
          <path d="M323 182a21 21 0 0 1 0 24" />
        </g>
      ) : null}

      {/* uplink */}
      <g className={offline ? s.uplinkOff : s.uplink} transform="translate(344 142)">
        {[9, 16, 23].map((r) => (
          <path key={r} d={arc(r, -82, -8)} />
        ))}
        <circle cx={0} cy={0} r={1.8} className={s.uplinkDot} />
        {offline ? <path d="M-6 6L26 -26" className={s.strike} /> : null}
      </g>

      {/* temperature probe on a stub */}
      <line x1={294} y1={236} x2={284} y2={236} className={s.arm} />
      <rect x={270} y={224} width={14} height={26} rx={1.5} className={s.solid} />
      <path d="M273 230h8M273 235h8M273 240h8" className={s.trace} />

      {/* ultrasonic sensor on its arm */}
      <rect x={334} y={sensorY - 25} width={CX - 34 - 334} height={5} className={s.solid} />
      <rect x={CX - 34} y={sensorY - 20} width={68} height={20} rx={2} className={s.solid} />
      <circle cx={CX - 17} cy={sensorY - 10} r={6.5} className={s.transducer} />
      <circle cx={CX + 17} cy={sensorY - 10} r={6.5} className={s.transducer} />

      {/* drawing notes */}
      {!compact ? (
        <g className={s.notes}>
          <text x={26} y={448} className={s.notesTitle}>
            NOTES
          </text>
          <text x={26} y={470}>1. Dimensions in centimetres.</text>
          <text x={26} y={488}>2. Sensor measures echo distance.</text>
          <text x={26} y={504}>{`   Depth = ${config.sensorHeight} − distance.`}</text>
          <text x={26} y={522}>3. Water drawn at measured depth.</text>
          <text x={26} y={540}>4. LEDs and buzzer mirror the real ones.</text>
        </g>
      ) : null}

      {/* callouts */}
      {!compact && reading ? (
        <g>
          <Callout
            side="left"
            x={26}
            y={74}
            title="Rain sensor"
            value={raining ? 'Raining' : 'Dry'}
            lines={[raining ? 'Board is wet' : sinceRainMin !== null ? `Last rain ${fmtDuration(sinceRainMin * 60000)} ago` : 'No rain on record']}
            anchor={[222, 126]}
          />
          <Callout
            side="left"
            x={26}
            y={160}
            title="ESP32 uplink"
            value={connection === 'live' ? 'Online' : connection === 'offline' ? 'No uplink' : 'Connecting'}
            lines={[connection === 'offline' && lastSeen ? `Last seen ${lastSeen} ago` : `Wi-Fi, every ${intervalSec} s`]}
            anchor={[266, 182]}
          />
          <Callout
            side="left"
            x={26}
            y={318}
            title="Temperature"
            value={`${fmtNum(reading.temperature)} °C`}
            lines={['Corrects the echo']}
            anchor={[270, 238]}
          />

          <Callout
            side="right"
            x={858}
            y={96}
            title="Ultrasonic sensor"
            value={`${fmtNum(config.sensorHeight - shown)} cm`}
            lines={['echo, sensor to water']}
            anchor={[CX + 34, sensorY - 12]}
          />
          <Callout
            side="right"
            x={858}
            y={352}
            title="Water level"
            value={fmtNum(reading.waterLevel)}
            unit="cm"
            lines={[`${pct}% of the ${depth} cm drain`, `${trendWord(reading.riseRate)} ${fmtSigned(reading.riseRate)} cm/min`]}
            anchor={[INNER_R, waterY]}
            hero
          />
        </g>
      ) : null}
    </svg>
  );
}

/* ---------- parts ---------- */

/** Sheet border with zone references along the edges, like a drawing office sheet. */
function Frame() {
  const cols = 8;
  const rows = 4;
  const zw = W / cols;
  const zh = H / rows;
  return (
    <g className={s.frame}>
      <rect x={4} y={4} width={W - 8} height={H - 8} className={s.frameRect} />
      <rect x={16} y={16} width={W - 32} height={H - 32} className={s.frameRect} />
      {Array.from({ length: cols }, (_, i) => (
        <g key={`c${i}`}>
          {i > 0 ? (
            <>
              <line x1={i * zw} x2={i * zw} y1={4} y2={16} />
              <line x1={i * zw} x2={i * zw} y1={H - 16} y2={H - 4} />
            </>
          ) : null}
          <text x={(i + 0.5) * zw} y={10.5} textAnchor="middle" dominantBaseline="middle">
            {i + 1}
          </text>
        </g>
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <g key={`r${i}`}>
          {i > 0 ? (
            <>
              <line x1={4} x2={16} y1={i * zh} y2={i * zh} />
              <line x1={W - 16} x2={W - 4} y1={i * zh} y2={i * zh} />
            </>
          ) : null}
          <text x={10} y={(i + 0.5) * zh} textAnchor="middle" dominantBaseline="middle">
            {String.fromCharCode(65 + i)}
          </text>
        </g>
      ))}
    </g>
  );
}

function Threshold({ y, label, tone }: { y: number; label: string; tone: 'warn' | 'crit' }) {
  return (
    <g className={s[tone]}>
      <line x1={INNER_L} x2={INNER_R} y1={y} y2={y} className={s.threshold} />
      <text x={INNER_R - 10} y={y - 6} textAnchor="end" className={s.thresholdLabel}>
        {label}
      </text>
    </g>
  );
}

/** A dimension line with arrowheads at both ends. */
function Dimension({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  const len = Math.abs(y2 - y1);
  const a = Math.min(7, len / 3);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  return (
    <g className={s.dim}>
      <line x1={x} x2={x} y1={top} y2={bottom} />
      <path d={`M${x} ${top}l-3 ${a}h6z`} className={s.arrow} />
      <path d={`M${x} ${bottom}l-3 ${-a}h6z`} className={s.arrow} />
    </g>
  );
}

interface CalloutProps {
  side: 'left' | 'right';
  x: number;
  y: number;
  title: string;
  value: string;
  unit?: string;
  lines: string[];
  anchor: [number, number];
  hero?: boolean;
}

/** Label with a ledge and a leader line to the thing it describes. */
function Callout({ side, x, y, title, value, unit, lines, anchor, hero }: CalloutProps) {
  const w = side === 'left' ? 176 : 232;
  const ledgeEnd = side === 'left' ? x + w : x;
  const ledgeStart = side === 'left' ? x : x + w;
  const ly = y + 8;
  const [ax, ay] = anchor;
  const elbowX = side === 'left' ? ledgeEnd + 14 : ledgeEnd - 18;
  const valueY = hero ? y + 84 : y + 38;

  return (
    <g className={s.callout}>
      <line x1={ledgeStart} x2={ledgeEnd} y1={ly} y2={ly} className={s.ledge} />
      <polyline points={`${ledgeEnd},${ly} ${elbowX},${ly} ${ax},${ay}`} className={s.leader} />
      <circle cx={ax} cy={ay} r={2.6} className={s.leaderDot} />
      <text x={x} y={y} className={s.calloutTitle}>
        {title}
      </text>
      <text x={x} y={valueY} className={hero ? s.heroValue : s.calloutValue}>
        {value}
        {unit ? <tspan className={s.heroUnit}> {unit}</tspan> : null}
      </text>
      {lines.map((t, i) => (
        <text key={i} x={x} y={valueY + (hero ? 28 : 22) + i * 17} className={s.calloutLine}>
          {t}
        </text>
      ))}
    </g>
  );
}

function Rain(): ReactNode {
  return (
    <g className={s.rain} aria-hidden="true">
      {range(60, 840, 28).map((x, i) => (
        <line
          key={x}
          x1={x + ((i * 17) % 11)}
          y1={30}
          x2={x + ((i * 17) % 11) - 4}
          y2={48}
          style={{ animationDelay: `${-((i * 37) % 100) / 60}s`, animationDuration: `${0.85 + ((i * 13) % 5) / 12}s` }}
        />
      ))}
    </g>
  );
}

function Drops(): ReactNode {
  return (
    <g className={s.drops} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={226 + i * 10} cy={104} r={1.6} style={{ animationDelay: `${-i * 0.4}s` }} />
      ))}
    </g>
  );
}

/* ---------- helpers ---------- */

function trendWord(rate: number): string {
  if (rate >= 0.3) return 'Rising';
  if (rate <= -0.3) return 'Falling';
  return 'Steady';
}

/** Circular arc of radius r from angle a to b (degrees, 0 = right, negative = up). */
function arc(r: number, a: number, b: number): string {
  const p = (deg: number) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
  const [x0, y0] = p(a);
  const [x1, y1] = p(b);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + 0.001; v += step) out.push(v);
  return out;
}

/** Wave line from x0 to x1 at y = 0. */
function waveLine(x0: number, x1: number, wl: number, amp: number): string {
  let d = `M${x0} 0q${wl / 4} ${-amp} ${wl / 2} 0`;
  const n = Math.ceil((x1 - x0) / (wl / 2));
  for (let i = 1; i < n; i++) d += `t${wl / 2} 0`;
  return d;
}

/** Water body: the wave line closed down to `bottom`. */
function wavePath(x0: number, x1: number, wl: number, amp: number, bottom: number): string {
  const n = Math.ceil((x1 - x0) / (wl / 2));
  return `${waveLine(x0, x1, wl, amp)}L${x0 + n * (wl / 2)} ${bottom}L${x0} ${bottom}Z`;
}

/** Short horizontal dashes under the surface, the drafting convention for water. */
function waterTicks(waterY: number): Array<{ x: number; y: number; len: number }> {
  const out: Array<{ x: number; y: number; len: number }> = [];
  const rows = Math.floor((FLOOR - waterY) / 20);
  for (let k = 1; k <= rows; k++) {
    for (let j = 0; j < 3; j++) {
      out.push({
        x: INNER_L + ((k * 97 + j * 131) % 340),
        y: k * 20,
        len: 22 + ((k * 7 + j * 13) % 24),
      });
    }
  }
  return out;
}
