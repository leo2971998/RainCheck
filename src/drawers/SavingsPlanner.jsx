import { useMemo, useState } from 'react';
import Drawer, { DrawerHeader } from '../components/Drawer.jsx';
import { budgetMoney as money } from '../components/BudgetImpact.jsx';
import { prettyIso } from '../components/ui.jsx';
import { householdFor, scenarioFor } from '../engine/plan.js';
import { fundedGoals } from '../engine/goal-funding.js';
import { spendingInsights } from '../engine/spending-insights.js';
import { savingsPreview } from '../engine/savings-plan.js';

export default function SavingsPlanner({ optimization = { status: 'loading' }, onRetry, onClose, ...props }) {
  const ready = optimization.status === 'ready' && optimization.data?.review?.status === 'complete' && optimization.data?.optimization?.draft;
  const waiting = ['loading', 'idle'].includes(optimization.status);
  return <Drawer label="Optimize budgets" onClose={onClose}>
    <DrawerHeader title="Optimize budgets" icon="target" onClose={onClose} />
    {ready ? <SavingsEditor {...props} result={optimization.data} onClose={onClose} /> : waiting ?
      <div className="optimization-wait" role="status" aria-live="polite"><span className="optimization-spinner" aria-hidden="true" />
        <h3>Optimizing your budgets</h3><p>Reviewing your spending history, checking possible limits and preparing an explanation.</p>
        <p className="fine">This can take about a minute. You can close this panel; your budgets will stay unchanged.</p></div> :
      <div className="optimization-wait" role="alert"><h3>{optimization.status === 'stale' ? 'Your plan changed' : 'Analysis could not finish'}</h3>
        <p>{optimization.status === 'stale' ? 'Run the analysis again using your latest budgets and preferences.' : optimization.error || 'Your budgets are unchanged. Please try again.'}</p>
        <button className="btn" onClick={onRetry}>Try again</button></div>}
    <p className="fine">No money moves here. Budgets change only after you confirm.</p>
  </Drawer>;
}

function SavingsEditor({ base, baseVersion, plan, protectedIds = {}, result, change, onClose }) {
  const h = useMemo(() => householdFor(base, plan), [base, plan]);
  const insights = spendingInsights(h, scenarioFor(h, plan), protectedIds);
  const goals = fundedGoals(base, plan).filter(g => g.saved < g.target && g.targetDate >= base.today);
  const [draft, setDraft] = useState(() => structuredClone(result.optimization.draft));
  const [reviewed, setReviewed] = useState(null), [error, setError] = useState('');
  const edited = JSON.stringify(draft) !== JSON.stringify(result.optimization.draft);
  const signature = JSON.stringify([baseVersion || base, plan, protectedIds, draft]);
  const preview = reviewed?.signature === signature ? reviewed.value : null;
  const edit = (field, id, value) => { setDraft(d => ({ ...d, [field]: { ...d[field], [id]: value } })); setReviewed(null); setError(''); };
  const calculate = e => {
    e.preventDefault(); setError('');
    try { setReviewed({ signature, value: savingsPreview(base, plan, draft, protectedIds) }); }
    catch (e) { setReviewed(null); setError(e.message); }
  };
  const confirm = () => {
    if (!preview?.hasChanges || !preview.canApply) return;
    try {
      const fresh = savingsPreview(base, plan, draft, protectedIds);
      if (!fresh.canApply || JSON.stringify(fresh) !== JSON.stringify(preview)) throw new Error('Your plan changed. Preview these amounts again.');
      change(fresh.patch, 'Spending & savings plan updated — no money moved'); onClose();
    } catch (e) { setError(e.message); setReviewed(null); }
  };
  return <>
    <section className="optimization-summary"><h3>Why these limits</h3>
      <p>{result.review.result.summary}</p>
      {!!result.review.result.observations?.length && <ul>{result.review.result.observations.map((o, i) => <li key={i}>{o.text}</li>)}</ul>}
      {!!result.review.result.questions?.length && <details><summary>Things to consider</summary><ul>{result.review.result.questions.map(q => <li key={q}>{q}</li>)}</ul></details>}
      {edited && <p className="fine" role="status">You have edited the starting proposal. This explanation refers to the original limits; Preview changes checks your new amounts.</p>}
    </section>
    <p className="savings-intro">Make these limits work for you, then preview their effect on your plan. Changes apply to future estimates from {prettyIso(h.today)}.</p>
    <form className="savings-form" onSubmit={calculate}>
      <section><h3>1. Choose monthly spending targets</h3><p className="fine">Keep replacement costs in mind—for example, eating at home can increase groceries.</p>
        <div className="savings-fields">{insights.categories.map(c => <div className="savings-field" key={c.id}>
          <div><label htmlFor={`saving-${c.id}`}><b>{c.label}</b><small>Current budget {money(c.budget)}{c.protected ? ' · kept unchanged' : ''}</small></label>
            </div>
          <input id={`saving-${c.id}`} type="number" inputMode="decimal" min="0" max={c.usual} step="0.01" required readOnly={c.protected}
            value={draft.targets[c.id] ?? c.budget} onChange={e => edit('targets', c.id, e.target.value)} />
        </div>)}</div></section>
      <section><h3>2. Plan extra savings <span className="fine">optional</span></h3><p className="fine">Leave at $0 to keep any freed-up money in checking. This schedules a contribution in your plan, not a bank transfer.</p>
        {goals.length ? <div className="savings-fields">{goals.map(g => <div className="savings-field" key={g.id}>
          <label htmlFor={`extra-${g.id}`}><b>{g.label}</b><small>{money(g.planned)}/month planned now · extra per month</small></label>
          <input id={`extra-${g.id}`} type="number" inputMode="decimal" min="0" max="1000000" step="0.01" value={draft.extras[g.id] ?? 0} onChange={e => edit('extras', g.id, e.target.value)} />
        </div>)}</div> : <p className="fine">No active, unfinished goals. You can still lower a spending target.</p>}</section>
      {error && <p className="alert" role="alert">{error}</p>}
      <button className="btn" type="submit">Preview changes</button>
    </form>
    {preview && <SavingsPreview preview={preview} onConfirm={confirm} />}
  </>;
}

export function SavingsPreview({ preview: p, onConfirm }) {
  return <section className="savings-preview" aria-label="Savings plan preview">
    <h3>3. Review before confirming</h3>
    <dl><div><dt>Potential room per month</dt><dd>{money(p.freed)}</dd></div>
      <div><dt>Extra planned toward goals</dt><dd>{money(p.extraSavings)}</dd></div>
      <div><dt>Left unallocated in checking</dt><dd>{money(p.remainingInChecking)}</dd></div>
      <div><dt>Total monthly goal contributions</dt><dd>{money(p.impact.before.contribution)} → {money(p.impact.after.contribution)}</dd></div></dl>
    {p.goalChanges.map(g => <p key={g.id}>{g.label}: {money(g.before)} → {money(g.after)}/month.</p>)}
    <p>{p.impact.after.fits ? 'The calculator finds room for the planned contributions through the goal deadlines.' : 'The plan still runs short at some point. Lower the proposed saving or review other costs.'}</p>
    <p className="fine">Assumes you follow these budgets and expected income arrives. Lower spending is not confirmed savings.</p>
    <button className="btn" type="button" disabled={!p.hasChanges || !p.canApply} onClick={onConfirm}>Confirm budget & savings changes</button>
    {!p.hasChanges && <p className="fine">No amounts have changed yet.</p>}
  </section>;
}
