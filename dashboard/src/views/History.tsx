import { useMemo, useState } from 'react';
import { LevelChart } from '../charts/LevelChart';
import type { Reading } from '../data/types';
import { fmtDateTime, fmtDuration, fmtNum, fmtSigned } from '../lib/format';
import { useDashboard } from '../state/DashboardProvider';
import { Icon } from '../ui/Icon';
import { LeaderRow, Leaders } from '../ui/Leaders';
import { Section } from '../ui/Section';
import { StatusBadge } from '../ui/StatusBadge';
import s from './History.module.css';

const RANGES = [
  { id: '1h', label: '1 hour', ms: 3600_000 },
  { id: '6h', label: '6 hours', ms: 6 * 3600_000 },
  { id: '24h', label: '24 hours', ms: 24 * 3600_000 },
  { id: '7d', label: '7 days', ms: 7 * 24 * 3600_000 },
] as const;

const PAGE_SIZE = 25;
const MAX_GAP_MS = 10 * 60_000;

function summarise(rows: Reading[]) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let peakRise = 0;
  const time = { NORMAL: 0, WARNING: 0, CRITICAL: 0 };
  let rainMs = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    min = Math.min(min, r.waterLevel);
    max = Math.max(max, r.waterLevel);
    sum += r.waterLevel;
    peakRise = Math.max(peakRise, r.riseRate);
    if (i < rows.length - 1) {
      const dt = Math.min(rows[i + 1].timestamp - r.timestamp, MAX_GAP_MS);
      time[r.status] += dt;
      if (r.rainDetected) rainMs += dt;
    }
  }
  return {
    min: rows.length ? min : 0,
    max: rows.length ? max : 0,
    avg: rows.length ? sum / rows.length : 0,
    peakRise,
    time,
    rainMs,
  };
}

function toCsv(rows: Reading[]): string {
  const head = 'timestamp_iso,local_time,water_level_cm,distance_cm,rise_rate_cm_per_min,rain_detected,temperature_c,status,blockage';
  const lines = rows.map((r) =>
    [
      new Date(r.timestamp).toISOString(),
      fmtDateTime(r.timestamp),
      r.waterLevel,
      r.distance,
      r.riseRate,
      r.rainDetected ? 1 : 0,
      r.temperature,
      r.status,
      r.blockage ? 1 : 0,
    ].join(','),
  );
  return [head, ...lines].join('\r\n');
}

export function History() {
  const { history, latest, config, device } = useDashboard();
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]['id']>('1h');
  const [page, setPage] = useState(0);

  const range = RANGES.find((r) => r.id === rangeId)!;
  const end = latest?.timestamp ?? (history.length ? history[history.length - 1].timestamp : 0);

  const rows = useMemo(() => history.filter((r) => r.timestamp >= end - range.ms), [history, end, range.ms]);
  const stats = useMemo(() => summarise(rows), [rows]);

  const newestFirst = useMemo(() => rows.slice().reverse(), [rows]);
  const pages = Math.max(1, Math.ceil(newestFirst.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = newestFirst.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date(end).toISOString().slice(0, 16).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `${device.id}_${range.id}_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={s.page}>
      <div className={s.intro}>
        <p>Every reading the drain has sent, drawn on recorder paper. Export a range to compare it with the manual measurements.</p>
        <button type="button" className="btn" onClick={exportCsv} disabled={rows.length === 0}>
          <Icon name="download" />
          Export CSV
        </button>
      </div>

      <Section
        title={`Water level, last ${range.label.toLowerCase()}`}
        aside={
          <div className="tabs" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                className="tab-btn"
                aria-pressed={r.id === rangeId}
                onClick={() => {
                  setRangeId(r.id);
                  setPage(0);
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      >
        <LevelChart data={rows} config={config} height={360} showDates={range.ms > 24 * 3600_000} />
      </Section>

      <Section title="Summary of this range">
        <div className={s.summary}>
          <Leaders>
            <LeaderRow label="Highest level" value={`${fmtNum(stats.max)} cm`} />
            <LeaderRow label="Lowest level" value={`${fmtNum(stats.min)} cm`} />
            <LeaderRow label="Average level" value={`${fmtNum(stats.avg)} cm`} />
            <LeaderRow label="Fastest rise" value={`${fmtSigned(stats.peakRise)} cm/min`} />
          </Leaders>
          <Leaders>
            <LeaderRow label="Time in warning" value={fmtDuration(stats.time.WARNING)} />
            <LeaderRow label="Time in critical" value={fmtDuration(stats.time.CRITICAL)} />
            <LeaderRow label="Rain detected for" value={fmtDuration(stats.rainMs)} />
            <LeaderRow label="Readings" value={String(rows.length)} />
          </Leaders>
        </div>
      </Section>

      <Section
        title="Readings"
        aside={
          <span className="mono">
            {rows.length === 0 ? '0' : `${safePage * PAGE_SIZE + 1}–${safePage * PAGE_SIZE + slice.length}`} of {rows.length}
          </span>
        }
      >
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th className={s.r}>Level cm</th>
                <th className={s.r}>Rise cm/min</th>
                <th>Rain</th>
                <th className={s.r}>Temp °C</th>
                <th>Status</th>
                <th>Blockage</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.timestamp}>
                  <td className="mono">{fmtDateTime(r.timestamp)}</td>
                  <td className={`${s.r} num`}>{fmtNum(r.waterLevel)}</td>
                  <td className={`${s.r} num`}>{fmtSigned(r.riseRate)}</td>
                  <td>{r.rainDetected ? 'Rain' : 'Dry'}</td>
                  <td className={`${s.r} num`}>{fmtNum(r.temperature)}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className={r.blockage ? s.flag : s.dim}>{r.blockage ? 'Possible' : 'None'}</td>
                </tr>
              ))}
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={7} className={s.none}>
                    No readings in this range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className={s.pager}>
          <button type="button" className="btn" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}>
            Newer
          </button>
          <span className="mono">
            Page {safePage + 1} of {pages}
          </span>
          <button type="button" className="btn" onClick={() => setPage(Math.min(pages - 1, safePage + 1))} disabled={safePage >= pages - 1}>
            Older
          </button>
        </div>
      </Section>
    </div>
  );
}
