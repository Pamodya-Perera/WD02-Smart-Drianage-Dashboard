import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DrainDrawing } from '../charts/DrainDrawing';
import { LevelChart } from '../charts/LevelChart';
import { minutesSinceRain } from '../lib/explain';
import { fmtDuration, fmtNum, fmtSigned, fmtTime } from '../lib/format';
import { useNow, useWidth } from '../lib/hooks';
import { narrate } from '../lib/narrate';
import { useDashboard } from '../state/DashboardProvider';
import { AlertRow } from '../ui/AlertRow';
import { LeaderRow, Leaders } from '../ui/Leaders';
import { Section } from '../ui/Section';
import { StatusBadge } from '../ui/StatusBadge';
import s from './Overview.module.css';

const WINDOWS = [
  { id: '15m', label: '15 min', ms: 15 * 60_000 },
  { id: '30m', label: '30 min', ms: 30 * 60_000 },
  { id: '1h', label: '1 hour', ms: 60 * 60_000 },
  { id: '3h', label: '3 hours', ms: 3 * 60 * 60_000 },
] as const;

export function Overview() {
  const { latest, history, config, alerts, statusSince, connection, lastReceivedAt, device, sourceName, expectedIntervalMs } = useDashboard();
  const now = useNow(1000);
  const [figRef, figWidth] = useWidth<HTMLElement>();
  const [windowId, setWindowId] = useState<(typeof WINDOWS)[number]['id']>('30m');
  const win = WINDOWS.find((w) => w.id === windowId)!;

  const recent = useMemo(() => {
    if (!latest) return [];
    const from = latest.timestamp - win.ms;
    return history.filter((r) => r.timestamp >= from);
  }, [history, latest, win.ms]);

  if (!latest) {
    return (
      <div className={s.waiting} role="status">
        <h1 className="serif">Waiting for the first reading.</h1>
        <p>Nothing has arrived from the device yet. This page fills in as soon as data comes in.</p>
      </div>
    );
  }

  const sinceRain = minutesSinceRain(history, latest);
  const story = narrate(latest, config, sinceRain);
  const stale = connection === 'offline';
  const compact = figWidth > 0 && figWidth < 780;
  const rate = latest.riseRate;
  const lastSeen = lastReceivedAt ? fmtDuration(now - lastReceivedAt) : null;
  const trend = rate >= 0.3 ? 'rising' : rate <= -0.3 ? 'falling' : 'steady';
  const isMock = sourceName === 'mock';

  return (
    <div className={s.page}>
      <header className={s.lede}>
        <div className={s.story}>
          <h1 className={s.headline}>{story.headline}</h1>
          <p className={s.detail} aria-live="polite">
            {story.detail}
          </p>
          {latest.blockage ? <p className={s.advice}>Check the drain inlet for leaves, silt or litter.</p> : null}
          {latest.status === 'CRITICAL' ? <p className={s.advice}>Alert the council and warn the public.</p> : null}
        </div>

        <table className={s.titleBlock}>
          <tbody>
            <tr>
              <th>Drawing</th>
              <td>{device.name}, section through the drain</td>
            </tr>
            <tr>
              <th>Site</th>
              <td>{device.location}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td>
                <StatusBadge status={latest.status} />
                {statusSince !== null ? <span className={s.forTime}> for {fmtDuration(latest.timestamp - statusSince)}</span> : null}
              </td>
            </tr>
            <tr>
              <th>Reading</th>
              <td className="mono">
                {fmtTime(latest.timestamp)}
                {isMock ? <span className={s.forTime}> sim clock</span> : null}
              </td>
            </tr>
          </tbody>
        </table>
      </header>

      {stale ? (
        <p className={s.notice} role="status">
          <b>No data coming in.</b> The device has been silent{lastSeen ? ` for ${lastSeen}` : ''}. The drawing shows the last reading, taken at{' '}
          <span className="mono">{fmtTime(latest.timestamp)}</span>.
        </p>
      ) : null}

      <figure ref={figRef} className={s.figure}>
        <DrainDrawing
          reading={latest}
          config={config}
          connection={connection}
          sinceRainMin={sinceRain}
          intervalSec={Math.round(expectedIntervalMs / 1000)}
          lastSeen={lastSeen}
          compact={compact}
        />
        {compact ? (
          <div className={s.compactList}>
            <Leaders>
              <LeaderRow label="Water level" value={`${fmtNum(latest.waterLevel)} cm`} />
              <LeaderRow label="Rise rate" value={`${fmtSigned(rate)} cm/min, ${trend}`} />
              <LeaderRow label="Echo distance" value={`${fmtNum(latest.distance)} cm`} />
              <LeaderRow label="Rain" value={latest.rainDetected ? 'Raining' : 'Dry'} />
              <LeaderRow label="Temperature" value={`${fmtNum(latest.temperature)} °C`} />
            </Leaders>
          </div>
        ) : null}
        <figcaption className={s.caption}>
          Fig. 1. The prototype drain in section. The LEDs and buzzer on the ESP32 box show what the real ones are doing, and the water is drawn at
          its measured depth.
        </figcaption>
      </figure>

      <Section
        title={`Water level, last ${win.label.toLowerCase()}`}
        aside={
          <div className="tabs" role="group" aria-label="Chart window">
            {WINDOWS.map((w) => (
              <button key={w.id} type="button" className="tab-btn" aria-pressed={w.id === windowId} onClick={() => setWindowId(w.id)}>
                {w.label}
              </button>
            ))}
          </div>
        }
      >
        <LevelChart data={recent} config={config} height={320} />
      </Section>

      <div className={s.lower}>
        <Section title="Logbook" aside={<Link to="/alerts">All entries</Link>}>
          {alerts.length === 0 ? (
            <p className={s.empty}>Nothing to report. The drain has been quiet.</p>
          ) : (
            <ul>
              {alerts.slice(0, 5).map((a) => (
                <AlertRow key={a.id} alert={a} withDate />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Dimensions">
          <Leaders>
            <LeaderRow label="Drain depth" value={`${config.drainDepth} cm`} />
            <LeaderRow label="Sensor height above floor" value={`${config.sensorHeight} cm`} />
            <LeaderRow label="Warning line" value={`${config.warningLevel} cm`} />
            <LeaderRow label="Critical line" value={`${config.criticalLevel} cm`} />
            <LeaderRow label="Rapid-rise limit" value={`${config.rapidRiseRate} cm/min`} />
            <LeaderRow label="Last packet" value={lastSeen ? `${lastSeen} ago` : 'n/a'} />
          </Leaders>
        </Section>
      </div>
    </div>
  );
}
