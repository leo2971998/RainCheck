import { useState } from 'react';
import Drawer, { DrawerHeader } from '../components/Drawer.jsx';
import BudgetImpact, { budgetMoney, budgetDate } from '../components/BudgetImpact.jsx';
import { BASE_GOAL, readGoal, readSubscription, goalChoices, fundGoalPatch, removeGoalPatch, subscriptionPatch, budgetImpact, planningLimit } from '../engine/budget.js';
import { householdFor } from '../engine/plan.js';
import { currentFunding } from '../engine/goal-funding.js';
import ReviewPanel from '../components/ReviewPanel.jsx';

export default function BudgetDrawer({ kind, id, base, baseVersion, plan, change, onClose }) {
  const isGoal = kind === 'goal';
  const current = householdFor(base, plan);
  const funding = currentFunding(base, plan);
  const existing = isGoal ? goalChoices(base, plan).find(g => g.id === id) : plan.subscriptions?.[id];
  const [itemId] = useState(() => id || `${isGoal ? 'goal' : 'sub'}-${crypto.randomUUID()}`);
  const [draft, setDraft] = useState(() => existing
    ? { ...existing, ...(isGoal ? { monthly: funding[id]?.monthly ?? '', saved: funding[id]?.saved ?? 0, active: funding[id]?.active ?? true } : {}) }
    : isGoal ? { label: '', target: '', targetDate: current.goal.targetDate, monthly: '', saved: 0, active: true }
      : { label: '', amount: '', startsOn: base.today });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const title = `${existing ? 'Edit' : 'Add'} ${isGoal ? 'goal' : 'subscription'}`;
  const update = e => { const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setDraft(d => ({ ...d, [e.target.name]: value })); setPreview(null); setError(''); };
  const showPreview = e => {
    e.preventDefault();
    try {
      const item = isGoal ? readGoal(draft, base.today) : readSubscription(draft, base.today);
      const patch = isGoal ? fundGoalPatch(base, plan, itemId, item,
        { monthly: Number(draft.monthly), saved: Number(draft.saved), active: draft.active }) : subscriptionPatch(itemId, item);
      setPreview({ item, patch, impact: budgetImpact(base, plan, patch) });
      setError('');
    } catch (e) { setPreview(null); setError(e.message); }
  };
  const remove = () => {
    const patch = isGoal ? removeGoalPatch(base, plan, itemId) : subscriptionPatch(itemId, null);
    setPreview({ removing: true, patch, impact: budgetImpact(base, plan, patch) });
    setError('');
  };
  const apply = () => {
    const label = preview.removing ? `${existing.label} removed from the plan`
      : isGoal ? `${preview.item.label} savings plan ${existing ? 'updated' : 'added'}` : `${preview.item.label} ${existing ? 'updated' : 'added'} in the budget`;
    change(preview.patch, label); onClose();
  };
  return <Drawer label={title} onClose={onClose}>
    <DrawerHeader title={title} icon={isGoal ? 'target' : 'repeat'} onClose={onClose} />
    <p>{isGoal ? 'Give this goal a monthly amount. Other goals stay in your plan. We check all contributions together before you confirm.'
      : 'Try a new monthly cost before you commit. This adds a budget estimate, not a real subscription.'}</p>
    {!preview && <form onSubmit={showPreview} className="budget-form">
      <label>{isGoal ? 'What are you saving for?' : 'Subscription name'}
        <input name="label" autoComplete="off" maxLength={60} value={draft.label} onChange={update} required placeholder={isGoal ? 'e.g. Family trip' : 'e.g. Music membership'} /></label>
      <label>{isGoal ? 'Total goal amount ($)' : 'Monthly cost ($)'}
        <input name={isGoal ? 'target' : 'amount'} type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01"
          value={isGoal ? draft.target : draft.amount} onChange={update} required placeholder="0.00" /></label>
      <label>{isGoal ? 'Target date' : 'First billing date'}
        <input name={isGoal ? 'targetDate' : 'startsOn'} type="date" min={base.today} max={planningLimit(base.today)}
          value={isGoal ? draft.targetDate : draft.startsOn} onChange={update} required /></label>
      {isGoal && <>
        <label>Monthly saving ($)<input name="monthly" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" value={draft.monthly} onChange={update} required placeholder="0.00" /></label>
        <label>Already saved for this goal ($)<input name="saved" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" value={draft.saved} onChange={update} required /></label>
        <p className="fine">{budgetMoney(Math.max(0, base.savings - Object.entries(funding).filter(([key, f]) => key !== itemId && f).reduce((s, [, f]) => s + f.saved, 0)))} available to allocate here. This assigns existing savings; it does not add money.</p>
        <label className="row"><input name="active" type="checkbox" checked={draft.active} onChange={update} />Save toward this goal each month</label>
        {!draft.active && <p className="fine">Paused: no new contributions. Money already allocated to this goal stays reserved for it.</p>}
      </>}
      <p className="fine">Forecast starts {base.today}. {isGoal ? 'This is a total savings target, including what is already saved.' : 'Billed monthly on this day, or the last day of a shorter month. Use this for an additional cost—not a bill already listed.'}</p>
      <button className="btn" type="submit">Preview impact</button>
    </form>}
    {error && <p role="alert" className="alert bad">{error}</p>}
    {preview && <>
      {isGoal && preview.item && <p><b>{preview.item.label} · {draft.active ? budgetMoney(Number(draft.monthly)) + '/month' : 'paused'}</b><br />Target {budgetMoney(preview.item.target)} by {budgetDate(preview.item.targetDate)}</p>}
      {!isGoal && preview.item && <p><b>{preview.item.label} · {budgetMoney(preview.item.amount)}/month</b><br />Starting {budgetDate(preview.item.startsOn)}</p>}
      {preview.removing && <div className="alert"><b>Remove {existing.label}?</b><p>{isGoal
        ? 'Its planned contributions stop and its allocated savings become unassigned. Other goals stay unchanged. Savings stay in the account.'
        : 'This removes the saved budget item only. No provider or bank records change.'}</p></div>}
      <BudgetImpact impact={preview.impact} />
      <details className="budget-ai-review"><summary>Ask AI about this preview</summary>
        <ReviewPanel key={baseVersion + JSON.stringify(plan) + JSON.stringify(preview.patch)} baseVersion={baseVersion} plan={plan} patch={preview.patch} kind={kind} />
      </details>
      <div className="row wrap budget-actions">
        <button className="btn" onClick={apply}>{preview.removing ? 'Confirm removal' : 'Apply to my budget'}</button>
        <button className="btn ghost" onClick={() => setPreview(null)}>Edit details</button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
      </div>
      <p className="fine">{isGoal ? 'Only this goal changes. Monthly amounts for your other goals stay the same.' : 'Applying keeps your planned savings contributions unchanged. If checking falls below the cushion, compare adjustments before committing.'} You can Undo after applying. Saved on this browser only.</p>
    </>}
    {existing && !(isGoal && itemId === BASE_GOAL) && !preview?.removing && <button className="link budget-remove" onClick={remove}>Remove {isGoal ? 'saved goal' : 'budget subscription'}</button>}
    {isGoal && itemId === BASE_GOAL && <p className="fine">You can edit or pause your emergency fund without removing other goals.</p>}
  </Drawer>;
}
