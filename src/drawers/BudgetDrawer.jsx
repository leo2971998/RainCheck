import { useState } from 'react';
import Drawer, { DrawerHeader, DrawerCloseButton } from '../components/Drawer.jsx';
import BudgetImpact, { budgetMoney, budgetDate } from '../components/BudgetImpact.jsx';
import { BASE_GOAL, readGoal, readSubscription, goalChoices, fundGoalPatch, removeGoalPatch, subscriptionPatch, budgetImpact, planningLimit } from '../engine/budget.js';
import { householdFor } from '../engine/plan.js';
import { currentFunding, monthlyGoalDates } from '../engine/goal-funding.js';
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
  const [customMonthly, setCustomMonthly] = useState(Boolean(existing));
  const slots = isGoal && draft.targetDate ? monthlyGoalDates(current.income, base.today, draft.targetDate).length : 0;
  const remaining = Math.max(0, Math.round(Number(draft.target) * 100) - Math.round(Number(draft.saved || 0) * 100));
  const suggested = slots && Number(draft.target) > 0 ? Math.ceil(remaining / slots) / 100 : '';
  const monthly = isGoal && !customMonthly ? suggested : draft.monthly;
  const available = Math.max(0, Math.round((base.savings - Object.entries(funding)
    .filter(([key, f]) => key !== itemId && f).reduce((s, [, f]) => s + f.saved, 0)) * 100) / 100);
  const nameOnly = existing && (isGoal
    ? Number(draft.target) === existing.target && draft.targetDate === existing.targetDate
      && Number(monthly) === (funding[id]?.monthly ?? 0) && Number(draft.saved) === (funding[id]?.saved ?? 0)
      && draft.active === (funding[id]?.active ?? true)
    : Number(draft.amount) === existing.amount && draft.startsOn === existing.startsOn);
  const title = `${existing ? 'Edit' : 'Add'} ${isGoal ? 'goal' : 'subscription'}`;
  const update = e => { const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (e.target.name === 'monthly') setCustomMonthly(true);
    setDraft(d => ({ ...d, [e.target.name]: value })); setPreview(null); setError(''); };
  const showPreview = e => {
    e.preventDefault();
    try {
      const item = isGoal ? readGoal(draft, base.today) : readSubscription(draft, base.today);
      if (isGoal && (monthly === '' || !/^\d+(\.\d{1,2})?$/.test(String(monthly)))) throw new Error('Enter a monthly amount with up to two decimal places.');
      const patch = isGoal ? fundGoalPatch(base, plan, itemId, item,
        { monthly: Number(monthly), saved: Number(draft.saved || 0), active: draft.active }) : subscriptionPatch(itemId, item);
      if (nameOnly) { change(patch, `${item.label} updated`); onClose(); return; }
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
  return <Drawer label={title} onClose={onClose} protectChanges>
    <DrawerHeader title={title} icon={isGoal ? 'target' : 'repeat'} onClose={onClose} />
    <p>{isGoal ? 'Choose an amount and a date. We’ll work out a monthly starting point for you.'
      : 'Add a monthly cost and preview how it changes your budget.'}</p>
    {!preview && <form onSubmit={showPreview} className="budget-form">
      <label>{isGoal ? 'What are you saving for?' : 'Subscription name'}
        <input name="label" autoComplete="off" maxLength={60} value={draft.label} onChange={update} required placeholder={isGoal ? 'e.g. Family trip' : 'e.g. Music membership'} /></label>
      <label>{isGoal ? 'Goal amount ($)' : 'Monthly cost ($)'}
        <input name={isGoal ? 'target' : 'amount'} type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01"
          value={isGoal ? draft.target : draft.amount} onChange={update} required placeholder="0.00" /></label>
      <label>{isGoal ? 'Save by' : 'First billing date'}
        <input name={isGoal ? 'targetDate' : 'startsOn'} type="date" min={isGoal ? new Date(Date.parse(base.today + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10) : base.today} max={planningLimit(base.today)}
          value={isGoal ? draft.targetDate : draft.startsOn} onChange={update} required /></label>
      {isGoal && <>
        <section className="goal-monthly-plan" aria-label="Monthly saving plan">
          <label>Save each month ($)<input name="monthly" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" value={monthly} onChange={update} required placeholder="Enter a goal amount first" aria-describedby="monthly-goal-help" /></label>
          <p className="fine" id="monthly-goal-help">{suggested !== ''
            ? `${budgetMoney(suggested)}/month over ${slots} monthly contributions reaches this target. You can choose a different amount.`
            : Number(draft.target) > 0 && draft.targetDate && !slots ? 'No contribution date falls before this deadline. Choose a later date or enter a monthly amount to preview.' : 'Enter your goal amount and date to see a monthly starting point.'}</p>
          {customMonthly && suggested !== '' && Number(monthly) !== suggested && <button className="link" type="button" onClick={() => { setCustomMonthly(false); setError(''); }}>Use {budgetMoney(suggested)}/month</button>}
          <p className="fine">Preview checks this alongside your bills and other goals.</p>
        </section>
        <details className="goal-savings-options"><summary>Use existing savings · optional</summary>
          <p>{available > 0 ? `${budgetMoney(available)} in savings is available for this goal.` : 'Your existing savings are assigned to other goals. This goal can start at $0.'}</p>
          <label>From existing savings ($)<input name="saved" type="number" inputMode="decimal" min="0" max={available} step="0.01" value={draft.saved} onChange={update} disabled={available === 0} /></label>
          <p className="fine">This sets aside money already in your savings account. It does not add money.</p>
        </details>
        {existing && <label className="goal-active"><input name="active" type="checkbox" checked={draft.active} onChange={update} />Save toward this goal each month</label>}
        {!draft.active && <p className="fine">Monthly saving is paused. Existing savings stay assigned to this goal.</p>}
      </>}
      {!isGoal && <p className="fine">Billed monthly on the date you choose. Use this for an additional cost—not a bill already listed.</p>}
      <div className="row wrap budget-actions"><button className="btn" type="submit">{nameOnly ? 'Save changes' : isGoal ? 'Preview goal' : 'Preview subscription'}</button>
        <DrawerCloseButton className="btn ghost">Cancel</DrawerCloseButton></div>
    </form>}
    {error && <p role="alert" className="alert bad">{error}</p>}
    {preview && <>
      {isGoal && preview.item && <p><b>{preview.item.label} · {draft.active ? budgetMoney(Number(monthly)) + '/month' : 'paused'}</b><br />Target {budgetMoney(preview.item.target)} by {budgetDate(preview.item.targetDate)}</p>}
      {!isGoal && preview.item && <p><b>{preview.item.label} · {budgetMoney(preview.item.amount)}/month</b><br />Starting {budgetDate(preview.item.startsOn)}</p>}
      {preview.removing && <div className="alert"><b>Remove {existing.label}?</b><p>{isGoal
        ? 'Its planned contributions stop and its allocated savings become unassigned. Other goals stay unchanged. Savings stay in the account.'
        : 'This removes the saved budget item only. No provider or bank records change.'}</p></div>}
      <BudgetImpact impact={preview.impact} />
      {!preview.removing && <details className="budget-ai-review"><summary>Ask AI about this preview</summary>
        <ReviewPanel key={baseVersion + JSON.stringify(plan) + JSON.stringify(preview.patch)} baseVersion={baseVersion} plan={plan} patch={preview.patch} kind={kind} />
      </details>}
      <div className="row wrap budget-actions">
        <button className="btn" onClick={apply}>{preview.removing ? `Remove ${isGoal ? 'goal' : 'subscription'}` : existing ? 'Save changes' : isGoal ? 'Save goal' : 'Add subscription'}</button>
        <button className="btn ghost" onClick={() => setPreview(null)}>{preview.removing ? `Keep ${isGoal ? 'goal' : 'subscription'}` : 'Back to details'}</button>
        {!preview.removing && <DrawerCloseButton className="btn ghost">Cancel</DrawerCloseButton>}
      </div>
    </>}
    {existing && !(isGoal && itemId === BASE_GOAL) && !preview && <button className="link budget-remove" onClick={remove}>Remove {isGoal ? 'goal' : 'subscription'}</button>}
  </Drawer>;
}
