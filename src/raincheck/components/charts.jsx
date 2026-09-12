import { useState } from 'react';
import { money, prettyDate } from './ui.jsx';

function niceTicks(min, max, n = 4) { const span = max - min, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw); const out = []; for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v); return out; }
export function AreaChart({ h, sim, id = 'a', height = 250 }) {
  const [hov, setHov] = useState(null);
  const days = sim.days, n = days.length, W = 920, Hh = height, L = 56, R = 18, T = 20, B = 30;
  const vals = days.map(d => d.balance); const maxV = Math.max(...vals, h.cushion) * 1.06; const minV = Math.min(0, ...vals) - 80;
  const x = i => L + (i / (n - 1)) * (W - L - R), y = v => T + (1 - (v - minV) / (maxV - minV)) * (Hh - T - B);
  const line = days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.balance).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${y(minV)} L${x(0)},${y(minV)} Z`;
  const ticks = niceTicks(Math.min(0, minV + 80), maxV);
  const lowI = days.indexOf(sim.low);
  const hoveredDay = hov !== null ? days[hov] : null;
  const tipX = hoveredDay ? Math.min(Math.max(x(hov) - 90, L), W - R - 190) : 0;
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" style={{ display: 'block' }} onMouseLeave={() => setHov(null)} role="img" aria-label={`Projected checking balance over the next ${n} days; lowest ${money(sim.low.balance)} on ${prettyDate(sim.low.date)}`}>
      <defs><linearGradient id={'g' + id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--rain)" stopOpacity=".26" /><stop offset="1" stopColor="var(--rain)" stopOpacity="0" /></linearGradient></defs>
      {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-ink)">{money(t)}</text></g>)}
      <line x1={L} x2={W - R} y1={y(h.cushion)} y2={y(h.cushion)} stroke="var(--sun-deep)" strokeDasharray="5 5" strokeWidth="1.2" />
      <text x={W - R} y={y(h.cushion) - 6} textAnchor="end" fontSize="11" fill="var(--sun-deep)" fontWeight="600">Cushion {money(h.cushion)}</text>
      {minV < 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--storm)" strokeWidth="1" opacity=".6" />}
      <path className="chart-area" d={area} fill={`url(#g${id})`} /><path className="chart-line" d={line} fill="none" stroke="var(--rain)" strokeWidth="2.4" strokeLinejoin="round" pathLength="1" />
      {days.map((d, i) => d.events.some(e => e.pay) ? <circle key={'p' + i} cx={x(i)} cy={y(d.balance)} r="4" fill="var(--mint)" stroke="var(--surface)" strokeWidth="1.5" /> : d.events.some(e => e.big) ? <circle key={'b' + i} cx={x(i)} cy={y(d.balance)} r="3.5" fill="var(--surface)" stroke="var(--rain)" strokeWidth="1.8" /> : null)}
      <circle cx={x(lowI)} cy={y(sim.low.balance)} r="5" fill={sim.low.state === 'ok' ? 'var(--good)' : sim.low.state === 'tight' ? 'var(--sun-deep)' : 'var(--storm)'} stroke="var(--surface)" strokeWidth="2" />
      <text x={x(lowI)} y={y(sim.low.balance) + 18} textAnchor={lowI > n * 0.8 ? 'end' : 'middle'} fontSize="11.5" fontWeight="600" fill="var(--ink-soft)">Low {money(sim.low.balance)} · {prettyDate(sim.low.date)}</text>
      {days.map((d, i) => (i % 7 === 0 || i === n - 1) && <text key={'x' + i} x={x(i)} y={Hh - 8} textAnchor="middle" fontSize="11" fill="var(--muted-ink)">{prettyDate(d.date)}</text>)}
      {days.map((d, i) => <rect key={'hoveredDay' + i} x={x(i) - (W - L - R) / (n - 1) / 2} y={T} width={(W - L - R) / (n - 1)} height={Hh - T - B} fill="transparent" onMouseEnter={() => setHov(i)} />)}
      {hoveredDay && <g className="tip"><line x1={x(hov)} x2={x(hov)} y1={T} y2={Hh - B} stroke="var(--muted-ink)" strokeDasharray="3 3" /><circle cx={x(hov)} cy={y(hoveredDay.balance)} r="4.5" fill="var(--rain)" stroke="var(--surface)" strokeWidth="2" />
        <rect x={tipX} y={T + 2} width="190" height={30 + 15 * Math.min(4, hoveredDay.events.length)} rx="8" fill="var(--ink)" opacity=".94" />
        <text x={tipX + 10} y={T + 20} fontSize="12" fontWeight="700" fill="var(--surface)">{prettyDate(hoveredDay.date)} · {money(hoveredDay.balance)}</text>
        {hoveredDay.events.slice(0, 4).map((e, k) => <text key={k} x={tipX + 10} y={T + 35 + 15 * k} fontSize="11" fill="var(--surface)">{e.label}: {e.amt > 0 ? '+' : ''}{money(e.amt)}</text>)}</g>}
    </svg>
  );
}
export function GoalChart({ h, cap, goal }) {
  const W = 420, Hh = 150, L = 44, R = 14, T = 14, B = 26; const months = ['Now', 'Oct', 'Nov', 'Dec', 'Jan'];
  const orig = [0, 1, 2, 3, 4].map(i => h.goal.saved + i * h.goal.planned), upd = [0, 1, 2, 3, 4].map(i => h.goal.saved + i * cap);
  const top = Math.max(2200, ...upd) * 1.05;
  const y = v => T + (1 - v / top) * (Hh - T - B), x = i => L + (i / 4) * (W - L - R);
  const pl = a => a.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" role="img" aria-label="Goal projection, original plan versus updated plan">
      {[0, 1000, 2000].map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--muted-ink)">{money(t)}</text></g>)}
      <line x1={L} x2={W - R} y1={y(h.goal.target)} y2={y(h.goal.target)} stroke="var(--good)" strokeDasharray="4 4" />
      <path className="chart-line-muted" d={pl(orig)} fill="none" stroke="var(--cloud-deep)" strokeWidth="2.2" strokeDasharray="6 4" /><path className="chart-line" d={pl(upd)} fill="none" stroke="var(--rain)" strokeWidth="2.6" pathLength="1" />
      {upd.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--rain)" stroke="var(--surface)" strokeWidth="1.5" />)}
      {months.map((m, i) => <text key={m} x={x(i)} y={Hh - 8} textAnchor="middle" fontSize="11" fill="var(--muted-ink)">{m}</text>)}
      <text x={W - R} y={y(h.goal.target) - 5} textAnchor="end" fontSize="10.5" fill="var(--good-deep)" fontWeight="600">Target {money(h.goal.target)}</text>
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
