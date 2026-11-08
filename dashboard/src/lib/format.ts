const pad = (n: number) => String(n).padStart(2, '0');

export function fmtTime(ts: number, withSeconds = true): string {
  const d = new Date(ts);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withSeconds ? `${hm}:${pad(d.getSeconds())}` : hm;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtDateTime(ts: number): string {
  return `${fmtDate(ts)}, ${fmtTime(ts)}`;
}

/** 83000 -> "1m 23s", 4000 -> "4s", 7500000 -> "2h 5m" */
export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

export function fmtNum(n: number, digits = 1): string {
  return n.toFixed(digits);
}

/** Signed with a true minus sign so columns of numbers line up. */
export function fmtSigned(n: number, digits = 1): string {
  const v = n.toFixed(digits);
  if (n > 0 && Number(v) !== 0) return `+${v}`;
  if (Number(v) === 0) return (0).toFixed(digits);
  return v.replace('-', '−');
}

export function dayLabel(ts: number, now: number): string {
  const a = new Date(ts);
  const b = new Date(now);
  const sameDay = a.toDateString() === b.toDateString();
  if (sameDay) return 'Today';
  const y = new Date(b);
  y.setDate(b.getDate() - 1);
  if (a.toDateString() === y.toDateString()) return 'Yesterday';
  return fmtDate(ts);
}
