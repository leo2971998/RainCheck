import { useState } from 'react';
import { money, prettyIso } from '../components/ui.jsx';
import { goalAt, goalPlan } from '../engine/forecast.js';
import { scenarioFor } from '../engine/plan.js';
import Drawer, { DrawerHeader, DrawerCloseButton } from '../components/Drawer.jsx';

// Preserve old planning choices without presenting them as verified company statements.
export default function BillDrawer({ h, billId, plan, change, cap, notes = {}, saveNote, onCompare, onClose }) {
  const bill = h.recurring.find(r => r.id === billId && r.change) ?? h.recurring.find(r => r.change);
  if (!bill) return null;
  return <EstimateEditor key={bill.id} {...{ h, bill, plan, change, cap, notes, saveNote, onCompare, onClose }} />;
}

function EstimateEditor({ h, bill, plan, change, cap, notes, saveNote, onCompare, onClose }) {
  const current = plan.whatIf?.[bill.id] ?? bill.change.to;
  const key = 'bill-estimate:' + bill.id;
  const [text, setText] = useState(notes[key] || '');
  const [amount, setAmount] = useState(String(current));
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const goal = h.fundedGoals ? goalPlan(h, scenarioFor(h, plan), h.goal) : goalAt(h, cap);
  const save = e => {
    e.preventDefault();
    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value < 0 || value > 1000000 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
      setError('Enter an amount with up to two decimal places.'); return;
    }
    if (value !== current) change({ whatIf: { [bill.id]: value } }, bill.label + ' forecast estimate updated');
    saveNote?.(key, text.trim());
    onClose();
  };
  return <Drawer label={bill.label + ' estimate & notes'} onClose={onClose} protectChanges>
    <DrawerHeader title={bill.payee || bill.label} onClose={onClose} />
    <span className="pill neutral">Saved forecast estimate</span>
    <div className="ba">
      <div><span className="k">Previous estimate</span><b>{money(bill.amount)}</b></div>
      <div><span className="k">Planned from {prettyIso(bill.change.effective)}</span><b>{money(current)}</b></div>
    </div>
    <p>This is a saved planning amount, not a recorded payment. Transactions do not establish why a bill changed or what the company will charge next.</p>
    <form className="budget-form" onSubmit={save}>
      <h3>Contact the company</h3>
      <p>Ask what changed and what to expect next time. Use the number on your statement or the company’s official website.</p>
      <label>Your notes<textarea rows={4} maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="Questions to ask, who you spoke with, and what they told you." /></label>
      <p className="fine">Notes stay in this browser. They are not sent to AI or the company.</p>
      <details><summary>Update the forecast estimate</summary>
        <label>Future bill estimate ($)<input type="number" min="0" max="1000000" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <p className="fine">Only a confirmed edit changes the forecast. It does not change the company’s price.</p>
      </details>
      <div className="row wrap budget-actions"><button className="btn" type="submit">Save notes &amp; estimate</button><DrawerCloseButton className="btn ghost">Cancel</DrawerCloseButton></div>
      {error && <p className="alert" role="alert">{error}</p>}
    </form>
    <details><summary>Impact on savings</summary>
      <div className="ba">
        <div><span className="k">Monthly saving that fits</span><b>{money(cap)}</b></div>
        <div><span className="k">{goal.shared ? 'Combined goal projection' : 'Goal projection'}</span><b>{money(goal.projected)}</b><span className="fine">{money(goal.gap)} short</span></div>
      </div>
      <p className="fine">Goal contributions stay unchanged until you edit them. Each goal keeps its own deadline; this projection can still leave checking below its buffer.</p>
      <button className="btn ghost sm" onClick={onCompare}>Compare options</button>
    </details>
    {plan.billChanges?.[bill.id] && (removing ? <section className="alert" role="region" aria-label="Remove estimate confirmation">
      <h3>Remove the {bill.label} estimate?</h3><p>Your forecast returns to the recorded bill amount. Your saved notes stay. The bill itself is not cancelled.</p>
      <div className="row wrap budget-actions"><button className="btn" onClick={() => {
        change({ billChanges: { [bill.id]: null }, whatIf: { [bill.id]: undefined } }, bill.label + ' saved estimate removed'); onClose();
      }}>Remove estimate</button><button className="btn ghost" onClick={() => setRemoving(false)}>Keep estimate</button></div>
    </section> : <button className="link budget-remove" onClick={() => setRemoving(true)}>Remove saved estimate</button>)}
  </Drawer>;
}
