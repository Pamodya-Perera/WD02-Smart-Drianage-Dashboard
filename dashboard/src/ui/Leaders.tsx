import type { ReactNode } from 'react';
import s from './Leaders.module.css';

/** Label ........ value, the way a table of contents or a spec sheet sets a row. */
export function Leaders({ children }: { children: ReactNode }) {
  return <dl className={s.list}>{children}</dl>;
}

export function LeaderRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className={s.row}>
      <dt>{label}</dt>
      <span className={s.fill} aria-hidden="true" />
      <dd className={mono ? 'mono' : 'num'}>{value}</dd>
    </div>
  );
}
