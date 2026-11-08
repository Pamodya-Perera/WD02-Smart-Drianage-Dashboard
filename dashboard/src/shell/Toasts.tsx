import { useEffect } from 'react';
import type { AlertEvent } from '../data/types';
import { fmtTime } from '../lib/format';
import { useDashboard } from '../state/DashboardProvider';
import { Icon } from '../ui/Icon';
import s from './Toasts.module.css';

const LIFETIME_MS = 8000;

function Toast({ alert, onClose }: { alert: AlertEvent; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, LIFETIME_MS);
    return () => window.clearTimeout(id);
  }, [onClose]);

  return (
    <div className={`${s.toast} ${s[alert.severity]}`}>
      <span className={s.mark} aria-hidden="true" />
      <div className={s.body}>
        <div className={s.title}>{alert.title}</div>
        <div className={s.detail}>{alert.detail}</div>
        <div className={`${s.time} mono`}>{fmtTime(alert.timestamp)}</div>
      </div>
      <button type="button" className={s.close} onClick={onClose} aria-label="Dismiss alert">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

export function Toasts({ clearOfDrawer }: { clearOfDrawer?: boolean }) {
  const { toasts, dismissToast } = useDashboard();
  return (
    <div className={`${s.stack} ${clearOfDrawer ? s.shifted : ''}`} role="alert" aria-live="assertive">
      {toasts.map((t) => (
        <Toast key={t.id} alert={t} onClose={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}
