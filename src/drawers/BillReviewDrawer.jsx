import { useState } from 'react';
import Drawer, { DrawerHeader } from '../components/Drawer.jsx';
import { budgetMoney, budgetDate } from '../components/BudgetImpact.jsx';
import { amountFor, nextChargeDate } from '../engine/forecast.js';
import { billReviewKey, billReviewPatch, createBillReview, NEXT_STEPS } from '../engine/bill-reviews.js';

export default function BillReviewDrawer({ id, h, plan, notes, ...actions }) {
  const historical = plan.billReviews?.[id];
  const bill = h.recurring.find(r => r.id === (historical?.billId || id));
  if (!bill) return <Drawer label="Bill review" onClose={actions.onClose}><DrawerHeader title="Bill review" onClose={actions.onClose} /><p>This bill is no longer available. Close this panel and refresh your household.</p></Drawer>;
  const charge = historical ? { ...bill, lastPosted: historical.amount, usual: historical.expected,
    lastPostedDate: historical.postedDate, lastPostedId: historical.postedId } : bill;
  const key = billReviewKey(charge);
  return <ReviewEditor key={key} bill={bill} charge={charge} record={historical || plan.billReviews?.[key]}
    note={notes?.[key] || ''} h={h} plan={plan} {...actions} />;
}

function ReviewEditor({ bill, charge, record, note, h, plan, change, saveNote, onClose }) {
  const key = billReviewKey(charge), current = amountFor(bill, nextChargeDate(bill, h.today), plan);
  const [estimate, setEstimate] = useState(String(record?.forecastAmount ?? current));
  const [nextStep, setNextStep] = useState(record?.nextStep || 'contact');
  const [text, setText] = useState(note), [error, setError] = useState(''), [copyStatus, setCopyStatus] = useState('');
  const otherReviews = Object.entries(plan.billReviews || {}).filter(([k, v]) => k !== key && v?.billId === bill.id)
    .sort((a,b) => b[1].postedDate.localeCompare(a[1].postedDate));
  const brief = [`Question about my ${bill.label} bill`,
    `A charge of ${budgetMoney(charge.lastPosted)} posted on ${budgetDate(charge.lastPostedDate)}. Earlier charges averaged ${budgetMoney(charge.usual ?? bill.amount)}.`,
    'Could you explain the difference? Was it usage, a one-time fee, a billing-period change, or a recurring rate change?',
    'What should I expect on the next bill? Please confirm any adjustment in writing.',
    ...(text.trim() ? [`My notes: ${text.trim()}`] : []),
    ...otherReviews.map(([,v]) => `Previous review — ${budgetDate(v.postedDate)}: ${budgetMoney(v.amount)}; ${NEXT_STEPS[v.nextStep]}.`),
  ].join('\n\n');
  const save = e => {
    e.preventDefault(); setError('');
    try {
      if (!estimate.trim()) throw new Error('Enter the amount you want to use in your forecast.');
      const next = createBillReview(charge, { forecastAmount: Number(estimate), nextStep });
      change(billReviewPatch(bill, charge, next), `${bill.label} charge reviewed`);
      saveNote(key, text.trim()); onClose();
    } catch (e) { setError(e.message); }
  };
  return <Drawer label={`Review ${bill.label} charge`} onClose={onClose} className="bill-review-drawer">
    <DrawerHeader title={`Review ${bill.label} charge`} icon="list" onClose={onClose} />
    <section className="bill-evidence"><span className="review-eyebrow">1 · What the bank recorded</span>
      <div className="ba"><div><span className="k">Earlier average</span><b>{budgetMoney(charge.usual ?? bill.amount)}</b></div>
        <div><span className="k">Posted {budgetDate(charge.lastPostedDate)}</span><b>{budgetMoney(charge.lastPosted)}</b></div></div>
      <p>The amount is different. Bank transactions do not tell us why, or whether the next bill will be the same.</p>
      {bill.recentCharges?.length > 1 && <details><summary>Recent posted charges</summary><ul className="bill-charge-history">
        {bill.recentCharges.map((p,i) => <li key={`${p.date}-${i}`}><span>{budgetDate(p.date)}</span><b>{budgetMoney(p.amount)}</b></li>)}
      </ul></details>}
    </section>
    <form className="budget-form" onSubmit={save}>
      <h3>2 · Choose what to budget</h3>
      <label>Future bill estimate ($)<input type="number" min="0" max="1000000" step="0.01" required value={estimate} onChange={e => setEstimate(e.target.value)} inputMode="decimal" /></label>
      <p className="fine">Currently {budgetMoney(current)} per bill. Keep it, or enter a different estimate. Saving changes your forecast, not the company's price or an actual payment.</p>
      <h3>3 · Keep a next step</h3>
      <label>Next step<select value={nextStep} onChange={e => setNextStep(e.target.value)}>{Object.entries(NEXT_STEPS).map(([k,v]) => <option value={k} key={k}>{v}</option>)}</select></label>
      <label>Your notes<textarea value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={2000} placeholder="Who you spoke with, their explanation, a reference number, or what to ask next time." /></label>
      <p className="fine">Notes stay in this browser. They are not sent to AI or the company. Avoid passwords and full account numbers.</p>
      <details className="bill-call-prep"><summary>Prepare questions for the company</summary>
        <p>Use contact information from your statement or the company's official website.</p>
        <pre>{brief}</pre><button type="button" className="btn ghost sm" onClick={async () => {
          try { await navigator.clipboard.writeText(brief); setCopyStatus('Questions copied. Nothing was sent.'); }
          catch { setCopyStatus('Copy was unavailable. You can select the questions above.'); }
        }}>Copy questions</button><p role="status" className="fine">{copyStatus}</p>
      </details>
      <button className="btn" type="submit">Save review</button>
      <p className="fine">This clears this charge's review alert. Your follow-up stays in history. A new unusual charge can alert you again; any remaining budget shortfall stays visible.</p>
    </form>
    {record?.reviewed && key === billReviewKey(bill) && <button className="link" onClick={() => {
      change({ billReviews: { [key]: { ...record, reviewed: false } } }, `${bill.label} review reopened`); onClose();
    }}>Reopen this charge for review</button>}
    {error && <p role="alert" className="alert">{error}</p>}
  </Drawer>;
}
