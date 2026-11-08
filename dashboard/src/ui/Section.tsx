import type { ReactNode } from 'react';
import s from './Section.module.css';

interface Props {
  title: string;
  /** Right side of the heading: tabs, counts, links. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A serif heading over a hairline rule, like a section of a printed report. */
export function Section({ title, aside, children, className }: Props) {
  return (
    <section className={`${s.section} ${className ?? ''}`}>
      <header className={s.head}>
        <h2 className={s.title}>{title}</h2>
        {aside ? <div className={s.aside}>{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}
