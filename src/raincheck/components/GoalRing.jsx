import { money } from './ui.jsx';
import { useCountUp } from '../hooks/useMotion.js';

/**
 * The goal as a ring: what is saved, drawn solid; where the plan lands, drawn behind it.
 *
 * Today's page used to repeat the Goals page's line chart. The two pages want different
 * things from the same numbers — Goals needs the month-by-month path, Today needs one glance —
 * so this is the glance. The shortfall is the gap between the pale arc and the top of the ring.
 */
export function GoalRing({ saved, target, projected, size = 128 }) {
  const r = 50, C = 2 * Math.PI * r;
  const savedF = useCountUp(Math.max(0, Math.min(1, saved / target)));
  const projF = useCountUp(Math.max(0, Math.min(1, projected / target)));
  const short = Math.max(0, target - projected);
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="ring" role="img"
      aria-label={`${money(saved)} saved of ${money(target)}; the plan reaches ${money(projected)}`}>
      <circle cx="60" cy="60" r={r} className="ring-track" />
      <circle cx="60" cy="60" r={r} className="ring-proj" strokeDasharray={`${projF * C} ${C}`} transform="rotate(-90 60 60)" />
      <circle cx="60" cy="60" r={r} className="ring-saved" strokeDasharray={`${savedF * C} ${C}`} transform="rotate(-90 60 60)" />
      <text x="60" y="57" textAnchor="middle" className="ring-big">{money(saved)}</text>
      <text x="60" y="74" textAnchor="middle" className="ring-sub">of {money(target)}</text>
      {short > 0 && <text x="60" y="90" textAnchor="middle" className="ring-short">{money(short)} short</text>}
    </svg>
  );
}
