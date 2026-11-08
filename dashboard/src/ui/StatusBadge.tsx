import type { Status } from '../data/types';
import s from './StatusBadge.module.css';

export const STATUS_LABEL: Record<Status, string> = {
  NORMAL: 'Normal',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
};

/** A square marker and the word, so status never depends on colour alone. */
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`${s.mark} ${s[status]}`}>
      <span className={s.square} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
