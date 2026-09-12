import { useState } from 'react';
import Drawer, { DrawerHeader } from '../components/Drawer.jsx';
import BudgetImpact, { budgetMoney, budgetDate } from '../components/BudgetImpact.jsx';
import { BASE_GOAL, readGoal, readSubscription, goalChoices, goalPatch, removeGoalPatch, subscriptionPatch, budgetImpact, planningLimit } from '../engine/budget.js';
import { householdFor } from '../engine/plan.js';

export default function BudgetDrawer({ kind, id, base, plan, change, onClose }) {
  const isGoal = kind === 'goal';
  const current = householdFor(base, plan);
  const activeId = plan.goalId || BASE_GOAL;
  const existing = isGoal ? goalChoices(base, plan).find(g => g.id === id) : plan.subscriptions?.[id];
  const [itemId] = useState(() => id || `${isGoal ? 'goal' : 'sub'}-${crypto.randomUUID()}`);
  const [draft, setDraft] = useState(() => existing
    ? { ...existing, ...(isGoal && id === activeId ? current.goal : {}) }
    : isGoal ? { label: '', target: '', targetDate: current.goal.targetDate }
      : { label: '', amount: '', startsOn: base.today });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const title = `${existing ? 'Edit' : 'Add'} ${isGoal ? 'goal' : 'subscription'}`;
  const update = e => { setDraft(d => ({ ...d, [e.target.name]: e.target.value })); setPreview(null); setError(''); };
  const showPreview = e => {
    e.preventDefault();
    try {
      const item = isGoal ? readGoal(draft, base.today) : readSubscription(draft, base.today);
      let patch = isGoal ? goalPatch(itemId, item, 0) : subscriptionPatch(itemId, item);
      if (isGoal) {
        const { after } = budgetImpact(base, plan, patch);
        patch = goalPatch(itemId, item, Math.min(after.required, after.supported));
      }
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
      : isGoal ? `${preview.item.label} is now the active goal` : `${preview.item.label} ${existing ? 'updated' : 'added'} in the budget`;
    change(preview.patch, label); onClose();
  };
  const saveIdea = () => { change({ goals: { [itemId]: preview.item } }, `${preview.item.label} saved for later`); onClose(); };
  return <Drawer label={title} onClose={onClose}>
    <DrawerHeader title={title} icon={isGoal ? 'target' : 'repeat'} onClose={onClose} />
    <p>{isGoal ? 'Explore one goal at a time. Your existing savings are counted once—not promised to several goals.'
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
      <p className="fine">Forecast starts {base.today}. {isGoal ? 'This is a total savings target, including what is already saved.' : 'Billed monthly on this day, or the last day of a shorter month. Use this for an additional cost—not a bill already listed.'}</p>
      <button className="btn" type="submit">Preview impact</button>
    </form>}
    {error && <p role="alert" className="alert bad">{error}</p>}
    {preview && <>
      {!isGoal && preview.item && <p><b>{preview.item.label} · {budgetMoney(preview.item.amount)}/month</b><br />Starting {budgetDate(preview.item.startsOn)}</p>}
      {preview.removing && <div className="alert"><b>Remove {existing.label}?</b><p>{isGoal && activeId === itemId
        ? `Your active goal returns to ${preview.impact.after.goalLabel}. Savings stay in the account.`
        : 'This removes the saved budget item only. No provider or bank records change.'}</p></div>}
      <BudgetImpact impact={preview.impact} />
      <div className="row wrap budget-actions">
        <button className="btn" onClick={apply}>{preview.removing ? 'Confirm removal' : isGoal ? 'Use this goal' : 'Apply to my budget'}</button>
        {isGoal && !preview.removing && itemId !== activeId && <button className="btn ghost" onClick={saveIdea}>Save for later instead</button>}
        <button className="btn ghost" onClick={() => setPreview(null)}>Edit details</button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
      </div>
      <p className="fine">{isGoal ? 'Choosing a goal replaces the current goal; it does not fund both.' : 'Applying keeps your planned savings contribution unchanged. If checking falls below the cushion, compare adjustments before committing.'} You can Undo after applying. Saved on this browser only.</p>
    </>}
    {existing && !(isGoal && itemId === BASE_GOAL) && !preview?.removing && <button className="link budget-remove" onClick={remove}>Remove {isGoal ? 'saved goal' : 'budget subscription'}</button>}
    {isGoal && itemId === BASE_GOAL && <p className="fine">Your starting savings goal stays available. You can edit it or choose another goal.</p>}
  </Drawer>;
}
