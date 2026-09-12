import { useState } from 'react';
import { Icon, Toggle, money } from '../components/ui.jsx';
import { goalAt } from '../engine/forecast.js';

export default function CompareDrawer({ h, sc, cap, options, protectedIds, setProtectedIds, onApply, onClose }) {
  const [pick, setPick] = useState('keep');
  const base = goalAt(h, cap);
  const chosen = options.find(o => o.id === pick);
  return (
    <div className="drawer-bg" onClick={onClose}><div className="drawer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Compare options">
      <div className="row between"><h2>Compare options</h2><button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon n="x" s={16} /></button></div>
      <p style={{ margin: 0, color: 'var(--ink-2)' }}>The {money(sc.increase)} increase leaves your plan <b className="num">{base.gap ? money(base.gap) : '$0'}</b> short of {money(h.goal.target)}. Preview a response. Applying updates your plan; it does not move money.</p>
      <div><h3 style={{ marginBottom: 8 }}>Protect</h3><div className="row wrap" style={{ gap: 12 }}>{h.allowances.map(a => <Toggle key={a.id} on={!!protectedIds[a.id]} onChange={v => setProtectedIds(p => ({ ...p, [a.id]: v }))}>{a.label}</Toggle>)}</div></div>
      {options.map(o => <div key={o.id} className={'option' + (pick === o.id ? ' on' : '')} style={{ opacity: o.disabled ? .6 : 1 }}>
        <div className="row between"><h3>{o.title}</h3>{o.cond && <span className="pill neutral">Conditional</span>}</div><p>{o.p}</p>
        {!o.disabled && <div className="ba"><div><span className="k">Before · {o.b[0]}</span><b>{o.b[1]}</b></div><div><span className="k">After · {o.a[0]}</span><b>{o.a[1]}</b><span className="fine">{o.a[2]}</span></div></div>}
        {!o.disabled && <div className="row between"><span className="fine">{o.x}</span><button className={'btn sm' + (pick === o.id ? '' : ' ghost')} onClick={() => setPick(o.id)}>{pick === o.id ? 'Selected' : 'Preview'}</button></div>}
      </div>)}
      <div className="alert good"><b>No option hides a cost.</b><p>Moving money from savings would fix checking but shrink the goal, so it is not offered here.</p></div>
      <button className="btn" disabled={!chosen || chosen.disabled} onClick={() => onApply(chosen)}>Apply this plan <Icon n="arrow" s={15} /></button>
    </div></div>
  );
}
