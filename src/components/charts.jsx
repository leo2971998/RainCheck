import { useState } from 'react';
import { money, prettyDate } from './ui.jsx';

function niceTicks(min, max, n = 4) { const span = max - min, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw); const out = []; for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v); return out; }
export function AreaChart({ h, sim, preview = null, id = 'a', height = 250 }) {
  const [hov, setHov] = useState(null);
  const days = sim.days, n = days.length, W = 920, Hh = height, L = 56, R = 18, T = 20, B = 30;
  const previewDays = preview?.days ?? null;
  const vals = [...days.map(d => d.balance), ...(previewDays?.map(d => d.balance) ?? [])];
  const maxV = Math.max(...vals, h.cushion) * 1.06; const minV = Math.min(0, ...vals) - 80;
  const x = i => L + (i / (n - 1)) * (W - L - R), y = v => T + (1 - (v - minV) / (maxV - minV)) * (Hh - T - B);
  const line = days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.balance).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${y(minV)} L${x(0)},${y(minV)} Z`;
  const ticks = niceTicks(Math.min(0, minV + 80), maxV);
  const lowI = days.indexOf(sim.low);
  const hoveredDay = hov !== null ? days[hov] : null;
  const tipX = hoveredDay ? Math.min(Math.max(x(hov) - 90, L), W - R - 190) : 0;
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" style={{ display: 'block' }} onMouseLeave={() => setHov(null)} role="img" aria-label={`Projected checking balance over the next ${n} days; lowest ${money(sim.low.balance)} on ${prettyDate(sim.low.date)}`}>
      <defs><linearGradient id={'g' + id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4F46E5" stopOpacity=".26" /><stop offset="1" stopColor="#4F46E5" stopOpacity="0" /></linearGradient></defs>
      {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#EEF0F6" /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#9CA3AF">{money(t)}</text></g>)}
      <line x1={L} x2={W - R} y1={y(h.cushion)} y2={y(h.cushion)} stroke="#D97706" strokeDasharray="5 5" strokeWidth="1.2" />
      <text x={W - R} y={y(h.cushion) - 6} textAnchor="end" fontSize="11" fill="#B45309" fontWeight="600">Cushion {money(h.cushion)}</text>
      {minV < 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#DC2626" strokeWidth="1" opacity=".6" />}
      <path d={area} fill={`url(#g${id})`} />
      <path d={line} fill="none" stroke={previewDays ? '#C7CBE0' : '#4F46E5'} strokeWidth="2.4" strokeLinejoin="round" />
      {previewDays && <>
        <path d={previewDays.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.balance).toFixed(1)}`).join(' ')}
          fill="none" stroke="#4F46E5" strokeWidth="2.6" strokeDasharray="7 4" strokeLinejoin="round" />
        <circle cx={x(previewDays.indexOf(preview.low))} cy={y(preview.low.balance)} r="5"
          fill={preview.low.balance >= h.cushion ? '#16A34A' : '#DC2626'} stroke="#fff" strokeWidth="2" />
        <text x={x(previewDays.indexOf(preview.low))} y={y(preview.low.balance) - 12} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#4F46E5">
          Preview {money(preview.low.balance)}
        </text>
      </>}
      {days.map((d, i) => d.events.some(e => e.pay) ? <circle key={'p' + i} cx={x(i)} cy={y(d.balance)} r="4" fill="#0D9488" stroke="#fff" strokeWidth="1.5" /> : d.events.some(e => e.big) ? <circle key={'b' + i} cx={x(i)} cy={y(d.balance)} r="3.5" fill="#fff" stroke="#4F46E5" strokeWidth="1.8" /> : null)}
      <circle cx={x(lowI)} cy={y(sim.low.balance)} r="5" fill={sim.low.state === 'ok' ? '#16A34A' : sim.low.state === 'tight' ? '#D97706' : '#DC2626'} stroke="#fff" strokeWidth="2" />
      <text x={x(lowI)} y={y(sim.low.balance) + 18} textAnchor={lowI > n * 0.8 ? 'end' : 'middle'} fontSize="11.5" fontWeight="600" fill="#374151">Low {money(sim.low.balance)} · {prettyDate(sim.low.date)}</text>
      {days.map((d, i) => (i % 7 === 0 || i === n - 1) && <text key={'x' + i} x={x(i)} y={Hh - 8} textAnchor="middle" fontSize="11" fill="#9CA3AF">{prettyDate(d.date)}</text>)}
      {days.map((d, i) => <rect key={'hoveredDay' + i} x={x(i) - (W - L - R) / (n - 1) / 2} y={T} width={(W - L - R) / (n - 1)} height={Hh - T - B} fill="transparent" onMouseEnter={() => setHov(i)}
        onTouchStart={() => setHov(i)} onClick={() => setHov(i)} style={{ cursor: 'pointer' }} />)}
      {hoveredDay && <g className="tip"><line x1={x(hov)} x2={x(hov)} y1={T} y2={Hh - B} stroke="#9CA3AF" strokeDasharray="3 3" /><circle cx={x(hov)} cy={y(hoveredDay.balance)} r="4.5" fill="#4F46E5" stroke="#fff" strokeWidth="2" />
        <rect x={tipX} y={T + 2} width="190" height={30 + 15 * Math.min(4, hoveredDay.events.length)} rx="8" fill="#111827" opacity=".94" />
        <text x={tipX + 10} y={T + 20} fontSize="12" fontWeight="700" fill="#fff">{prettyDate(hoveredDay.date)} · {money(hoveredDay.balance)}</text>
        {hoveredDay.events.slice(0, 4).map((e, k) => <text key={k} x={tipX + 10} y={T + 35 + 15 * k} fontSize="11" fill="#C9CEE3">{e.label}: {e.amt > 0 ? '+' : ''}{money(e.amt)}</text>)}</g>}
    </svg>
  );
}
export function GoalChart({ h, cap, goal }) {
  // Points and labels come from the goal itself, so extending it to five contributions extends
  // the chart too. These used to be a fixed Oct-Nov-Dec-Jan with four points, which meant the
  // chart quietly disagreed with the schedule beside it.
  const left = goal?.left ?? h.goal.left;
  const schedule = goal?.schedule ?? [];
  const W = 420, Hh = 150, L = 44, R = 14, T = 14, B = 26;
  const orig = Array.from({ length: left + 1 }, (_, i) => h.goal.saved + i * h.goal.planned);
  const upd = Array.from({ length: left + 1 }, (_, i) => h.goal.saved + i * cap);
  const top = Math.max(h.goal.target * 1.1, ...upd, ...orig) * 1.02;
  const y = v => T + (1 - v / top) * (Hh - T - B);
  const x = i => L + (i / Math.max(1, left)) * (W - L - R);
  const pl = a => a.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const labels = ['Now', ...schedule.map(d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }))];
  const ticks = [0, Math.round(h.goal.target / 2), h.goal.target];
  const every = left > 6 ? 2 : 1;                     // keep labels readable on a long goal
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" role="img" aria-label="Goal projection, original plan versus updated plan">
      {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#EEF0F6" />
        <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#9CA3AF">{money(t)}</text></g>)}
      <line x1={L} x2={W - R} y1={y(h.goal.target)} y2={y(h.goal.target)} stroke="#16A34A" strokeDasharray="4 4" />
      <path d={pl(orig)} fill="none" stroke="#C7CBE0" strokeWidth="2.2" strokeDasharray="6 4" />
      <path d={pl(upd)} fill="none" stroke="#4F46E5" strokeWidth="2.6" />
      {upd.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#4F46E5" stroke="#fff" strokeWidth="1.5" />)}
      {labels.map((m, i) => (i % every === 0 || i === left) &&
        <text key={i} x={x(i)} y={Hh - 8} textAnchor="middle" fontSize="11" fill="#9CA3AF">{m}</text>)}
      <text x={W - R} y={y(h.goal.target) - 5} textAnchor="end" fontSize="10.5" fill="#15803D" fontWeight="600">Target {money(h.goal.target)}</text>
    </svg>
  );
}

export function CashBars({ h, sim }) {
  const data = [...h.history, { m: 'Oct', inc: sim.cash.income, out: sim.cash.bills + sim.cash.everyday + sim.cash.savings, proj: true }];
  const max = Math.max(...data.flatMap(d => [d.inc, d.out]));
  return (
    <div className="grid g32" style={{ gap: 24 }}>
      <div className="bars">{data.map(d => <div className="grp" key={d.m}><div className="pair"><div className={'b in'} style={{ height: d.inc / max * 100 + '%' }} title={`Income ${money(d.inc)}`}></div><div className={'b out' + (d.proj ? ' proj' : '')} style={{ height: d.out / max * 100 + '%' }} title={`Spending ${money(d.out)}`}></div></div><span className="m">{d.m}{d.proj ? ' (proj.)' : ''}</span></div>)}</div>
      <div className="kv" style={{ alignContent: 'start' }}>
        <span className="k"><span className="dot" style={{ background: 'var(--teal)', marginRight: 6 }}></span>Income in October</span><span className="v">{money(sim.cash.income)}</span>
        <span className="k">Recurring bills</span><span className="v">{money(sim.cash.bills)}</span>
        <span className="k">Everyday spending</span><span className="v">{money(sim.cash.everyday)}</span>
        <span className="k">To savings</span><span className="v">{money(sim.cash.savings)}</span>
        <span className="k" style={{ fontWeight: 600, color: 'var(--ink)' }}>Left over</span><span className="v" style={{ fontWeight: 700 }}>{money(sim.cash.income - sim.cash.bills - sim.cash.everyday - sim.cash.savings)}</span>
      </div>
    </div>
  );
}

/**
 * A compact forecast for the comparison drawer, so a preview is visible wherever the user opened
 * it from — not only behind the panel on one particular page.
 */
export function MiniForecast({ h, sim, preview = null, height = 110 }) {
  const days = sim.days, n = days.length, W = 460, L = 38, R = 10, T = 12, B = 16;
  const previewDays = preview?.days ?? null;
  const vals = [...days.map(d => d.balance), ...(previewDays?.map(d => d.balance) ?? []), h.cushion];
  const maxV = Math.max(...vals) * 1.08, minV = Math.min(0, ...vals) - 40;
  const x = i => L + (i / (n - 1)) * (W - L - R);
  const y = v => T + (1 - (v - minV) / (maxV - minV)) * (height - T - B);
  const path = list => list.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.balance).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img"
      aria-label={`Lowest ${money(sim.low.balance)}${preview ? `, or ${money(preview.low.balance)} under this option` : ''}`}>
      <line x1={L} x2={W - R} y1={y(h.cushion)} y2={y(h.cushion)} stroke="#D97706" strokeDasharray="4 4" />
      <text x={L - 6} y={y(h.cushion) + 4} textAnchor="end" fontSize="9.5" fill="#B45309">{money(h.cushion)}</text>
      <path d={path(days)} fill="none" stroke={previewDays ? '#C7CBE0' : '#4F46E5'} strokeWidth="2" />
      {previewDays && <path d={path(previewDays)} fill="none" stroke="#4F46E5" strokeWidth="2.2" strokeDasharray="6 3" />}
      <circle cx={x(days.indexOf(sim.low))} cy={y(sim.low.balance)} r="3.5" fill={previewDays ? '#9CA3AF' : (sim.low.balance >= h.cushion ? '#16A34A' : '#DC2626')} />
      {previewDays && <circle cx={x(previewDays.indexOf(preview.low))} cy={y(preview.low.balance)} r="4"
        fill={preview.low.balance >= h.cushion ? '#16A34A' : '#DC2626'} stroke="#fff" strokeWidth="1.5" />}
    </svg>
  );
}
