import { useState } from 'react';
import { Icon, money } from './ui.jsx';

export default function IncomeList({ h, sc, setSc, compact }) {
  const [editing, setEditing] = useState(null);
  const income = sc.income || h.income;
  const update = (id, patch) => setSc(s => ({ ...s, income: income.map(p => p.id === id ? { ...p, ...patch } : p) }));
  return (
    <div className="card">
      <div className="hd"><h2>Expected income</h2><span className="fine">Editable</span></div>
      <table><tbody>{income.map(p => (
        <tr key={p.id}><td style={{ paddingLeft: 0 }}><div className="cat"><i className="in"><Icon n="dollar" s={14} /></i><div><div style={{ fontWeight: 500 }}>{compact ? 'Paycheck' : p.label}</div><div className="fine">{new Date(p.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · <span className={'pill ' + (p.status === 'confirmed' ? 'good' : p.status === 'edited' ? 'accent' : 'neutral')}>{p.status === 'confirmed' ? 'Confirmed' : p.status === 'edited' ? 'Edited by you' : 'Estimated'}</span></div></div></div></td>
          <td className="r" style={{ paddingRight: 0 }}>{editing === p.id ? <div className="row" style={{ justifyContent: 'flex-end' }}><input type="number" value={p.amount} onChange={e => update(p.id, { amount: Number(e.target.value) || 0, status: 'edited' })} aria-label="Amount" /><input type="date" value={p.date} onChange={e => update(p.id, { date: e.target.value, status: 'edited' })} aria-label="Date" /><button className="btn sm" onClick={() => setEditing(null)}>Done</button></div>
            : <div className="row" style={{ justifyContent: 'flex-end' }}><b className="num" style={{ color: 'var(--good)' }}>+{money(p.amount)}</b><button className="btn ghost sm" onClick={() => setEditing(p.id)}><Icon n="edit" s={14} />Edit</button></div>}</td></tr>))}</tbody></table>
      <div className="fine">Change an amount or date and the forecast updates. Estimated paychecks come from your pattern; RainCheck never invents irregular income.</div>
    </div>
  );
}
