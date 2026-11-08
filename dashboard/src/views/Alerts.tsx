import { useMemo, useState } from 'react';
import type { AlertEvent, Severity } from '../data/types';
import { dayLabel } from '../lib/format';
import { useDashboard } from '../state/DashboardProvider';
import { AlertRow } from '../ui/AlertRow';
import { Section } from '../ui/Section';
import s from './Alerts.module.css';

type Filter = 'all' | Severity;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'warning', label: 'Warning' },
  { id: 'info', label: 'Info' },
];

export function Alerts() {
  const { alerts, latest } = useDashboard();
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c = { all: alerts.length, critical: 0, warning: 0, info: 0 };
    for (const a of alerts) c[a.severity] += 1;
    return c;
  }, [alerts]);

  const groups = useMemo(() => {
    const now = latest?.timestamp ?? Date.now();
    const out: Array<{ label: string; items: AlertEvent[] }> = [];
    for (const a of alerts) {
      if (filter !== 'all' && a.severity !== filter) continue;
      const label = dayLabel(a.timestamp, now);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(a);
      else out.push({ label, items: [a] });
    }
    return out;
  }, [alerts, filter, latest]);

  return (
    <div className={s.page}>
      <div className={s.intro}>
        <p>The drain's logbook: every change of status, rapid rise, blockage and loss of connection, newest first.</p>
        <div className="tabs" role="group" aria-label="Filter by severity">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className="tab-btn" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} <span className={s.n}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <Section title="Logbook">
          <p className={s.empty}>{alerts.length === 0 ? 'Nothing to report. The drain has been quiet.' : 'Nothing matches this filter.'}</p>
        </Section>
      ) : (
        groups.map((g) => (
          <Section key={g.label} title={g.label} aside={<span className="mono">{g.items.length}</span>}>
            <ul>
              {g.items.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </ul>
          </Section>
        ))
      )}
    </div>
  );
}
