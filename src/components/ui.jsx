import { useCountUp } from '../hooks/useMotion.js';
export const money = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export const moneyPrecise = n => (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const prettyDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const longDate = d => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
export const asDate = iso => new Date(iso + 'T12:00:00');
export const prettyIso = iso => prettyDate(asDate(iso));
export const weekdayIso = iso => asDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
/** The next time a day-of-month falls, on or after `todayIso`. */
export const nextOccurrence = (todayIso, day) => {
  const d = asDate(todayIso), here = new Date(d.getFullYear(), d.getMonth(), day, 12);
  return (here >= d ? here : new Date(d.getFullYear(), d.getMonth() + 1, day, 12)).toISOString().slice(0, 10);
};
/** An inclusive list of items as a sentence: "a, b and c". */
export const listOf = xs => xs.length < 2 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
export const STATE = { ok: ['On track', 'good'], tight: ['Tight', 'warn'], below: ['Below cushion', 'bad'], over: ['Overdrawn', 'bad'] };
/** The month a date falls in. The old version was a fixed list that ran out in July 2027, so a
 *  sixteen-contribution goal was silently clamped to the wrong headline. */
export const monthOf = iso => iso
  ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  : '—';

export const Icon = ({ n, s = 18, c = 'currentColor' }) => {
  const p = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const d = {
    gear: <><path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3z" /><circle cx="12" cy="12" r="3" /></>,
    dash: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>,
    trend: <><path d="M3 17l5-6 4 4 5-8 4 5" /></>, list: <><path d="M4 6h16M4 12h16M4 18h10" /></>, repeat: <><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>,
    bars: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>, target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2" /></>,
    bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2zM10 20a2 2 0 0 0 4 0" /></>, search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
    x: <><path d="M6 6l12 12M18 6L6 18" /></>, check: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>, arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>, warn: <><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18h.01" /></>,
    up: <><path d="M12 19V5M6 11l6-6 6 6" /></>, down: <><path d="M12 5v14M6 13l6 6 6-6" /></>, edit: <><path d="M4 20h4l10-10-4-4L4 16v4z" /><path d="M13 7l4 4" /></>, ext: <><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
    bank: <><path d="M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18" /></>, mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>, shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /></>, dollar: <><path d="M12 2v20M17 6.5C17 4.6 14.8 3 12 3S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5S14.8 17 12 17s-5-1.6-5-3.5" /></>,
    swap: <><path d="M4 7h13l-3-3M20 17H7l3 3" /></>, cart: <><circle cx="9" cy="20" r="1" /><circle cx="17" cy="20" r="1" /><path d="M3 4h2l2.5 11h11L21 7H6" /></>, spark: <><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></>,
  }[n];
  return <svg {...p}>{d}</svg>;
};

/**
 * A number that travels to its new value instead of teleporting.
 *
 * `format` receives a partway number during the tween, so anything rounded stays readable the
 * whole way across rather than flickering through decimals.
 */
export function Num({ v, format = money }) {
  const shown = useCountUp(v);
  return <>{format(Math.round(shown))}</>;
}

export function Kpi({ label, value, sub, pill }) { return <div className="card kpi" style={{ gap: 6 }}><div className="row between"><span className="l">{label}</span>{pill}</div><div className="v">{value}</div><div className="s">{sub}</div></div>; }
export function Toggle({ on, onChange, children }) { return <label className={'toggle' + (on ? ' on' : '')}><input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} /><i></i>{children}</label>; }
