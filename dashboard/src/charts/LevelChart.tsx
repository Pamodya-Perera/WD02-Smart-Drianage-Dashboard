import { scaleLinear, scaleTime } from 'd3-scale';
import { curveLinear, line } from 'd3-shape';
import { useMemo, useState } from 'react';
import type { DeviceConfig, Reading, Status } from '../data/types';
import { fmtDate, fmtDateTime, fmtNum, fmtSigned, fmtTime } from '../lib/format';
import { useWidth } from '../lib/hooks';
import { STATUS_LABEL } from '../ui/StatusBadge';
import s from './LevelChart.module.css';

interface Props {
  data: Reading[];
  config: DeviceConfig;
  height?: number;
  /** Show dates on the time axis (for multi-day ranges). */
  showDates?: boolean;
}

const MARGIN = { top: 22, right: 14, bottom: 30, left: 40 };
const MAX_POINTS = 700;

/** Keeps each bucket's highest reading so short peaks survive thinning. */
function thin(data: Reading[]): Reading[] {
  if (data.length <= MAX_POINTS) return data;
  const size = Math.ceil(data.length / MAX_POINTS);
  const out: Reading[] = [];
  for (let i = 0; i < data.length; i += size) {
    let best = data[i];
    for (let j = i; j < Math.min(i + size, data.length); j++) if (data[j].waterLevel > best.waterLevel) best = data[j];
    out.push(best);
  }
  const last = data[data.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function nearestIndex(data: Reading[], t: number): number {
  let lo = 0;
  let hi = data.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].timestamp < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(data[lo - 1].timestamp - t) < Math.abs(data[lo].timestamp - t)) return lo - 1;
  return lo;
}

/** Contiguous runs where `pick` holds, as [start, end, value] triples. */
function spansBy<T>(data: Reading[], pick: (r: Reading) => T | null): Array<[number, number, T]> {
  const out: Array<[number, number, T]> = [];
  let start: number | null = null;
  let cur: T | null = null;
  for (let i = 0; i < data.length; i++) {
    const v = pick(data[i]);
    if (v !== cur) {
      if (start !== null && cur !== null) out.push([start, data[i - 1].timestamp, cur]);
      start = v === null ? null : data[i].timestamp;
      cur = v;
    }
  }
  if (start !== null && cur !== null) out.push([start, data[data.length - 1].timestamp, cur]);
  return out;
}

export function LevelChart({ data, config, height = 300, showDates = false }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo(() => thin(data), [data]);
  const rain = useMemo(() => spansBy<true>(points, (r) => (r.rainDetected ? true : null)), [points]);
  const alerts = useMemo(() => spansBy<Status>(points, (r) => (r.status === 'NORMAL' ? null : r.status)), [points]);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const depth = config.drainDepth;

  const t0 = points.length ? points[0].timestamp : 0;
  const t1 = points.length ? points[points.length - 1].timestamp : 1;
  const x = scaleTime()
    .domain([new Date(t0), new Date(t1 === t0 ? t0 + 1 : t1)])
    .range([0, innerW]);
  const y = scaleLinear().domain([0, depth]).range([innerH, 0]);

  const trace = line<Reading>()
    .x((d) => x(new Date(d.timestamp)))
    .y((d) => y(d.waterLevel))
    .curve(curveLinear)(points);

  const minor: number[] = [];
  for (let v = 0; v <= depth; v += 5) minor.push(v);
  const xTicks = x.ticks(Math.max(2, Math.floor(innerW / 120)));
  const xMinor = x.ticks(Math.max(4, Math.floor(innerW / 24)));

  const hovered = hover !== null && points[hover] ? points[hover] : null;
  const last = points.length ? points[points.length - 1] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!points.length || innerW <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - MARGIN.left;
    setHover(nearestIndex(points, x.invert(Math.max(0, Math.min(innerW, px))).getTime()));
  };

  const hx = hovered ? MARGIN.left + x(new Date(hovered.timestamp)) : 0;
  const flip = hovered ? hx > width * 0.6 : false;

  return (
    <div className={s.wrap}>
      <div ref={ref} className={s.chart} style={{ height }}>
        {width > 0 && points.length > 1 && last ? (
          <>
            <svg
              width={width}
              height={height}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              role="img"
              aria-label={`Water level trace. Latest ${fmtNum(last.waterLevel)} centimetres.`}
            >
              <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                <rect x={0} y={0} width={innerW} height={innerH} className={s.paper} />

                {xMinor.map((t) => (
                  <line key={`xm${t.getTime()}`} x1={x(t)} x2={x(t)} y1={0} y2={innerH} className={s.gridMinor} />
                ))}
                {xTicks.map((t) => (
                  <g key={`xt${t.getTime()}`}>
                    <line x1={x(t)} x2={x(t)} y1={0} y2={innerH} className={s.gridMajor} />
                    <text x={x(t)} y={innerH + 19} textAnchor="middle" className={s.axis}>
                      {showDates ? `${fmtDate(t.getTime())} ${fmtTime(t.getTime(), false)}` : fmtTime(t.getTime(), false)}
                    </text>
                  </g>
                ))}
                {minor.map((v) => (
                  <g key={v}>
                    <line x1={0} x2={innerW} y1={y(v)} y2={y(v)} className={v % 10 === 0 ? s.gridMajor : s.gridMinor} />
                    {v % 10 === 0 ? (
                      <text x={-10} y={y(v)} textAnchor="end" dominantBaseline="middle" className={s.axis}>
                        {v}
                      </text>
                    ) : null}
                  </g>
                ))}
                <text x={-10} y={-12} textAnchor="end" className={s.axis}>
                  cm
                </text>

                <line x1={0} x2={innerW} y1={y(config.warningLevel)} y2={y(config.warningLevel)} className={s.lineWarn} />
                <line x1={0} x2={innerW} y1={y(config.criticalLevel)} y2={y(config.criticalLevel)} className={s.lineCrit} />
                <text x={6} y={y(config.warningLevel) - 6} className={s.thWarn}>
                  WARNING {config.warningLevel}
                </text>
                <text x={6} y={y(config.criticalLevel) - 6} className={s.thCrit}>
                  CRITICAL {config.criticalLevel}
                </text>

                {/* event pens: rain along the top edge, alert states along the bottom */}
                {rain.map(([a, b]) => (
                  <rect key={`r${a}`} x={x(new Date(a))} y={-9} width={Math.max(2, x(new Date(b)) - x(new Date(a)))} height={4} className={s.penRain} />
                ))}
                {alerts.map(([a, b, st]) => (
                  <rect
                    key={`a${a}`}
                    x={x(new Date(a))}
                    y={innerH - 5}
                    width={Math.max(2, x(new Date(b)) - x(new Date(a)))}
                    height={5}
                    className={st === 'CRITICAL' ? s.penCrit : s.penWarn}
                  />
                ))}

                <path d={trace ?? ''} className={s.trace} />
                <circle cx={x(new Date(last.timestamp))} cy={y(last.waterLevel)} r={3.5} className={s.tip} />

                {hovered ? (
                  <g pointerEvents="none">
                    <line x1={x(new Date(hovered.timestamp))} x2={x(new Date(hovered.timestamp))} y1={0} y2={innerH} className={s.cross} />
                    <circle cx={x(new Date(hovered.timestamp))} cy={y(hovered.waterLevel)} r={4.5} className={s.dot} />
                  </g>
                ) : null}

                <rect x={0} y={0} width={innerW} height={innerH} className={s.frame} />
              </g>
            </svg>

            {hovered ? (
              <div className={`${s.note} ${flip ? s.noteLeft : ''}`} style={{ left: hx }} role="status">
                <div className={s.noteTime}>{fmtDateTime(hovered.timestamp)}</div>
                <div className={s.noteRow}>
                  <span>Water level</span>
                  <b className="num">{fmtNum(hovered.waterLevel)} cm</b>
                </div>
                <div className={s.noteRow}>
                  <span>Rise rate</span>
                  <b className="num">{fmtSigned(hovered.riseRate)} cm/min</b>
                </div>
                <div className={s.noteRow}>
                  <span>Rain</span>
                  <b>{hovered.rainDetected ? 'Yes' : 'No'}</b>
                </div>
                <div className={s.noteRow}>
                  <span>Temperature</span>
                  <b className="num">{fmtNum(hovered.temperature)} °C</b>
                </div>
                <div className={s.noteRow}>
                  <span>Status</span>
                  <b>{STATUS_LABEL[hovered.status]}</b>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className={s.empty}>{points.length === 0 ? 'No readings in this range' : 'Waiting for readings…'}</div>
        )}
      </div>

      <div className={s.legend}>
        <span className={s.key}>
          <i className={s.swTrace} />
          Water level
        </span>
        <span className={s.key}>
          <i className={s.swRain} />
          Rain (top edge)
        </span>
        <span className={s.key}>
          <i className={s.swWarn} />
          Warning
        </span>
        <span className={s.key}>
          <i className={s.swCrit} />
          Critical (bottom edge)
        </span>
      </div>
    </div>
  );
}
