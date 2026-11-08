import type { AlertEvent } from '../data/types';
import { fmtDate, fmtTime } from '../lib/format';
import s from './AlertRow.module.css';

const SEVERITY_LABEL = { info: 'Info', warning: 'Warning', critical: 'Critical' } as const;

interface Props {
  alert: AlertEvent;
  /** Show the date under the time, for lists that mix days. */
  withDate?: boolean;
}

export function AlertRow({ alert, withDate }: Props) {
  return (
    <li className={`${s.row} ${s[alert.severity]}`}>
      <span className={s.time}>
        <span className="mono">{fmtTime(alert.timestamp)}</span>
        {withDate ? <span className={s.date}>{fmtDate(alert.timestamp)}</span> : null}
      </span>
      <span className={s.text}>
        <span className={s.title}>
          <span className={s.dot} aria-hidden="true" />
          <span className="sr-only">{SEVERITY_LABEL[alert.severity]}: </span>
          {alert.title}
        </span>
        <span className={s.detail}>{alert.detail}</span>
      </span>
    </li>
  );
}
