import { Icon, money } from '../components/ui.jsx';
import { goalAt } from '../engine/forecast.js';

export default function BillDrawer({ h, notice, sc, setSc, cap, onCompare, onClose }) {
  const r = h.recurring.find(x => x.change); const inc = sc.increase; const g = goalAt(h, cap);
  return (
    <div className="drawer-bg" onClick={onClose}><div className="drawer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Bill change details">
      <div className="row between"><div className="cat"><i className="rec"><Icon n="repeat" s={14} /></i><h2>{r.label}</h2></div><button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon n="x" s={16} /></button></div>
      <div className="row wrap" style={{ gap: 6 }}><span className="pill warn"><Icon n="up" s={11} />Upcoming increase</span><span className="pill good"><Icon n="check" s={11} />Confirmed from a notice</span></div>
      <div className="kv"><span className="k">Previous recurring amount</span><span className="v">{money(r.amount)}/month</span><span className="k">New recurring amount</span><span className="v">{money(r.amount + inc)}/month</span><span className="k">Increase</span><span className="v" style={{ fontWeight: 700 }}>{money(inc)}/month</span><span className="k">Explanation</span><span className="v">{r.change.why}</span><span className="k">Next affected payment</span><span className="v">October 1</span></div>
      <h3>Evidence</h3>
      <div className="notice">{notice.split('\n').map((line, i) => { const hit = r.change.evidence?.some(e => line.includes(e)); return <div key={i}>{hit ? <mark>{line}</mark> : (line || ' ')}</div>; })}</div>
      <div className="fine">A price change, not higher usage, a longer billing period, or a one-time fee. The next posted charge will confirm it.</div>
      <h3>What it changes in your plan</h3>
      <div className="ba"><div><span className="k">Supported contribution</span><b>{money(cap)}</b><span className="fine">was {money(h.goal.planned)}</span></div><div><span className="k">Goal at target date</span><b>{money(g.projected)}</b><span className="fine">{g.gap ? `${money(g.gap)} short of ${money(h.goal.target)}` : 'on target'}</span></div></div>
      <h3>For the judges: change the increase</h3>
      <div className="row"><span className="muted">Increase of</span><input type="number" min="0" step="5" value={inc} onChange={e => setSc(s => ({ ...s, increase: Math.max(0, Number(e.target.value) || 0) }))} aria-label="Increase amount" /><span className="muted">per month. Everything recomputes.</span></div>
      <div className="row wrap" style={{ gap: 8 }}><button className="btn" onClick={onCompare}>Compare options <Icon n="arrow" s={15} /></button><button className="btn ghost sm" disabled title="Notice shown above"><Icon n="mail" s={14} />View notice</button><button className="btn ghost sm" disabled title="Provider support is not connected"><Icon n="ext" s={14} />Provider support</button><button className="btn ghost sm" disabled title="Question preparation is not available">Prepare a question</button></div>
      <div className="fine">RainCheck does not promise to negotiate this, and does not call every increase an error.</div>
    </div></div>
  );
}
