import { useMemo, useRef, useState } from 'react';
import Drawer, { DrawerHeader } from '../components/Drawer.jsx';
import { budgetMoney as money } from '../components/BudgetImpact.jsx';
import { householdFor, scenarioFor } from '../engine/plan.js';
import { fundedGoals } from '../engine/goal-funding.js';
import { spendingInsights } from '../engine/spending-insights.js';
import { savingsPreview } from '../engine/savings-plan.js';
import { prettyIso } from '../components/ui.jsx';
import { planningLimit } from '../engine/budget.js';

const monthName = date => new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long' });

export default function SavingsPlanner({ optimization = { status: 'loading' }, onRetry, onClose, ...props }) {
  const ready = optimization.status === 'ready' && optimization.data?.review?.status === 'complete' && optimization.data?.optimization?.draft;
  const waiting = ['loading', 'idle'].includes(optimization.status);
  return <Drawer label="Optimize budgets" onClose={onClose} protectChanges>
    <DrawerHeader title="Optimize budgets" icon="target" onClose={onClose} />
    {ready ? <SavingsEditor {...props} result={optimization.data} onClose={onClose} /> : waiting ?
      <div className="optimization-wait" role="status" aria-live="polite"><span className="optimization-spinner" aria-hidden="true" />
        <h3>Optimizing your budgets</h3><p>Reviewing your spending history, checking possible limits and preparing an explanation.</p>
        <p className="fine">This can take about a minute. You can close this panel; your budgets will stay unchanged.</p></div> :
      <div className="optimization-wait" role="alert"><h3>{optimization.status === 'stale' ? 'Your plan changed' : 'Analysis could not finish'}</h3>
        <p>{optimization.status === 'stale' ? 'Run the analysis again using your latest budgets and preferences.' : optimization.error || 'Your budgets are unchanged. Please try again.'}</p>
        <button className="btn" onClick={onRetry}>Try again</button></div>}
  </Drawer>;
}

/**
 * The proposal, as numbers first.
 *
 * This used to open with four paragraphs of review prose above five number fields, and the two
 * halves never met: the reader had to hold "household has already run above its limit" in their
 * head and then work out which box that was about. Worse, the review contract forbids figures in
 * its text, so the only part of the screen allowed to say $836 was the part nobody reached.
 *
 * So the arithmetic leads — what each limit is now, what is proposed, what that frees — and the
 * effect recalculates as the numbers are edited rather than hiding behind a Preview step.
 * Only the review's short summary is shown alongside the amounts.
 */
function SavingsEditor({ base, baseVersion, plan, protectedIds = {}, result, change, onClose }) {
  const h = useMemo(() => householdFor(base, plan), [base, plan]);
  const insights = spendingInsights(h, scenarioFor(h, plan), protectedIds);
  const goals = fundedGoals(base, plan).filter(g => g.saved < g.target && g.targetDate >= base.today);
  const [draft, setDraft] = useState(() => structuredClone(result.optimization.draft));
  const [manualTargets, setManualTargets] = useState({});
  // Keep unchanged constrains the AI. A user edit overrides it only for that category's proposal.
  const previewProtection = useMemo(() => Object.fromEntries(
    Object.entries(protectedIds).filter(([id]) => !manualTargets[id])), [protectedIds, manualTargets]);
  const [error, setError] = useState('');
  const edited = JSON.stringify(draft) !== JSON.stringify(result.optimization.draft);

  // Recomputed by the same function that runs again inside confirm, so what is on screen and what
  // gets applied cannot drift apart. A half-typed number is not an error worth shouting about, so
  // the last valid figures stay up and only the apply button is withheld.
  const live = useMemo(() => {
    try { return { value: savingsPreview(base, plan, draft, previewProtection), problem: '' }; }
    catch (e) { return { value: null, problem: e.message }; }
  }, [base, plan, draft, previewProtection]);
  const lastGood = useRef(null);
  if (live.value) lastGood.current = live.value;
  const shown = live.value ?? lastGood.current;

  const edit = (field, id, value) => {
    if (field === 'targets') setManualTargets(ids => ({ ...ids, [id]: true }));
    setDraft(d => ({ ...d, [field]: { ...d[field], [id]: value } })); setError('');
  };
  const confirm = () => {
    if (!live.value?.hasChanges || !live.value.canApply) return;
    try {
      const fresh = savingsPreview(base, plan, draft, previewProtection);
      if (!fresh.canApply || JSON.stringify(fresh) !== JSON.stringify(live.value)) throw new Error('Your plan changed. Check these amounts again.');
      change(fresh.patch, 'Spending & savings plan updated'); onClose();
    } catch (e) { setError(e.message); }
  };

  const review = result.review.result;
  const guidance = live.value?.guidance;
  const goalNeeds = new Map(guidance?.goals.map(g => [g.id, g]) || []);
  const recovery = guidance?.recovery;
  const complete = live.value?.impact.after.fits && live.value.impact.after.gap === 0 && guidance?.remainingNeeded === 0 && recovery?.complete !== false;

  return <>
    {!!guidance?.overBudget.length && <section className="optimization-problem" aria-label="Spending to review">
      {guidance.overBudget.map(c => <div key={c.id}><b>{c.label}: {money(c.over)} over</b>
        <p>{money(c.spent)} spent against a {money(c.budget)} limit.</p></div>)}
      <p>Check these purchases in Transactions. If a cost was one-time, it may not repeat. Lowering a limit cannot recover money already spent.</p>
    </section>}
    {result.optimization.draft.recovery && <section className="optimization-problem recovery-objective" aria-label="Recovery objective">
      <label><input type="checkbox" checked={!!draft.recovery} onChange={e => setDraft(d => ({ ...d, recovery: e.target.checked ? structuredClone(result.optimization.draft.recovery) : null }))} /> Plan to recover this overspend</label>
      {draft.recovery && <div className="recovery-fields">
        <label>Recover ($)<input aria-label="Amount to recover" type="number" min="0.01" max="1000000" step="0.01" value={draft.recovery.amount}
          onChange={e => edit('recovery', 'amount', e.target.value)} /></label>
        <label>By<input aria-label="Recovery deadline" type="date" min={base.today} max={planningLimit(base.today)} value={draft.recovery.deadline}
          onChange={e => edit('recovery', 'deadline', e.target.value)} /></label>
      </div>}
      <p>Your existing goal contributions stay in the plan. Recovery is an optional target, not another bill.</p>
      {recovery && <>
        <dl className="recovery-totals"><div><dt>Required reduction</dt><dd>{money(recovery.requiredMonthly)}/month</dd></div>
          <div><dt>These limits could recover by {prettyIso(recovery.deadline)}</dt><dd>{money(Math.min(recovery.amount, recovery.projected))} of {money(recovery.amount)}</dd></div>
          <div><dt>Still to recover</dt><dd>{money(recovery.remaining)}</dd></div></dl>
        {!recovery.complete ? <p><b>{money(recovery.extraMonthlyNeeded)}/month more is needed.</b> Review the purchases, edit the limits below, or give recovery more time.</p>
          : <p>These limits cover the recovery target if you follow them. Your recorded spending is unchanged.</p>}
        {recovery.laterDate && <button type="button" className="btn ghost sm" onClick={() => edit('recovery', 'deadline', recovery.laterDate)}>Try {prettyIso(recovery.laterDate)}, {recovery.laterDate.slice(0, 4)} instead</button>}
        <p className="fine">Only the remaining days count this month. Money added to goals is not counted twice toward recovery.</p>
      </>}
    </section>}
    <section className="optimization-result" aria-label="Proposed effect">
      <div className="optimization-headline">
        <b className="num">{money(Math.abs(shown?.freed ?? 0))}</b><span>{shown?.freed < 0 ? 'more' : 'less'} spending per month</span>
        {shown && <span className={'pill ' + (complete ? 'good' : 'warn')}>
          {!live.value ? 'Check amounts' : !live.value.impact.after.fits ? 'Forecast still runs short' : recovery && !recovery.complete ? 'Recovery still short' : complete ? recovery ? 'Recovery & goals fit' : guidance.overBudget.length ? 'Goal funding unchanged' : 'Fits your forecast' : 'Goals still need funding'}</span>}
      </div>
      {guidance && <>
        <p className="fine">{money(Math.abs(guidance.thisMonthReduction))} {guidance.thisMonthReduction < 0 ? 'more' : 'less'} spending for the rest of {monthName(base.today)} if you follow these limits.</p>
        <p className="optimization-purpose">{guidance.additionalNeeded == null ? 'Add an upcoming income date or extend a goal deadline to work out its monthly saving.'
          : guidance.additionalNeeded > 0 ? <>Your goals need <b>{money(guidance.additionalNeeded)}/month more</b> than you currently plan.
            {guidance.uncoveredByCuts > 0 ? <> Even using all these cuts, <b>{money(guidance.uncoveredByCuts)}/month still needs another source</b> or a later goal date.</>
              : ' Choose how to assign the available money below.'}</>
            : guidance.goals.length ? <>No extra monthly saving needed to meet the goal amounts.
              {live.value.impact.after.fits ? recovery ? ' Recovering the overspend is the separate target above.' : ' These cuts leave more room in checking.' : ' But expected cash cannot cover the current contributions. These cuts alone do not fix that.'}</>
              : 'These cuts leave more room in checking. Add a goal to plan savings.'}</p>
      </>}
      {review.summary && <p className="optimization-note">{review.summary}</p>}
      {edited && <p className="fine" role="status">You have changed the starting numbers. That note describes the limits the review proposed.</p>}
    </section>

    <form className="savings-form" onSubmit={e => e.preventDefault()}>
      <section>
        <h3>Monthly limits</h3>
        <div className="limit-rows">
          <div className="limit-row limit-row-head"><span>Category</span><span className="r">Now</span><span className="r">New limit</span><span className="r">Frees</span></div>
          {insights.categories.map(c => {
            const freed = live.value?.changes.find(change => change.id === c.id)?.freed ?? 0;
            return <div className="limit-row" key={c.id}>
              <label htmlFor={`saving-${c.id}`}><b>{c.label}</b>
                <small>{c.spent == null ? 'No records this month' : `${money(c.spent)} spent so far`}
                  {manualTargets[c.id] ? ' · edited by you' : c.protected ? ' · unchanged by AI' : ''}</small>
                {c.over > 0 && <small className="limit-review">{money(c.over)} already over · review before cutting</small>}</label>
              <span className="r num limit-now">{money(c.budget)}</span>
              <input id={`saving-${c.id}`} type="number" inputMode="decimal" min="0" max={c.usual} step="0.01" required
                value={draft.targets[c.id] ?? c.budget} onChange={e => edit('targets', c.id, e.target.value)} />
              <span className={'r num limit-freed' + (freed > 0 ? ' is-freed' : '')}>{freed > 0 ? money(freed) : '—'}</span>
            </div>;
          })}
        </div>
        <p className="fine">Keep replacement costs in mind — eating at home can raise groceries.</p>
      </section>

      <section><h3>Send the freed money to a goal <span className="fine">optional</span></h3>
        <p className="fine">Add to the monthly amounts below, or leave at $0 to keep the room in checking.</p>
        {goals.length ? <div className="savings-fields">{goals.map(g => { const need = goalNeeds.get(g.id); return <div className="savings-field" key={g.id}>
          <label htmlFor={`extra-${g.id}`}><b>{g.label}</b><small>{money(g.planned)}/month planned · extra per month</small>
            {need && <small>{need.needed == null ? 'No payment date before the deadline' : <>{money(need.needed)}/month needed · {money(need.remaining)} left across {need.paymentsLeft} monthly payments</>}</small>}
            <small>By {prettyIso(g.targetDate)}</small></label>
          <input id={`extra-${g.id}`} type="number" inputMode="decimal" min="0" max="1000000" step="0.01" value={draft.extras[g.id] ?? 0} onChange={e => edit('extras', g.id, e.target.value)} />
        </div>; })}</div> : <p className="fine">No active, unfinished goals. You can still lower a spending limit.</p>}</section>
    </form>

    {live.problem && <p className="fine" role="status">{live.problem}</p>}
    {error && <p className="alert" role="alert">{error}</p>}
    {shown && <SavingsPreview preview={shown} onConfirm={confirm} disabled={!live.value} />}
  </>;
}

export function SavingsPreview({ preview: p, onConfirm, disabled = false }) {
  return <section className="savings-preview" aria-label="Savings plan preview">
    <h3>What changes</h3>
    <dl><div><dt>Room freed each month</dt><dd>{money(p.freed)}</dd></div>
      <div><dt>Extra planned toward goals</dt><dd>{money(p.extraSavings)}</dd></div>
      <div><dt>Left unallocated in checking</dt><dd>{money(p.remainingInChecking)}</dd></div>
      <div><dt>Total monthly goal contributions</dt><dd>{money(p.impact.before.contribution)} → {money(p.impact.after.contribution)}</dd></div></dl>
    {p.goalChanges.map(g => <p key={g.id}>{g.label}: {money(g.before)} → {money(g.after)}/month.</p>)}
    {!disabled && <>
      {p.guidance?.remainingNeeded > 0 && <p><b>Still {money(p.guidance.remainingNeeded)}/month to assign</b> to meet every goal deadline.</p>}
      {p.guidance?.recovery?.remaining > 0 && <p><b>Recovery is not fully covered:</b> {money(p.guidance.recovery.remaining)} would still be left on {prettyIso(p.guidance.recovery.deadline)}.</p>}
      <p>{p.impact.after.fits ? p.guidance?.remainingNeeded === 0 && p.impact.after.gap === 0 ? 'These contributions reach your goal amounts and fit the forecast.'
        : 'The selected contributions fit the forecast, but not every goal deadline is funded.'
        : <><b>These cuts are not enough.</b>{p.impact.after.fundingLow != null && <> On {prettyIso(p.impact.after.fundingLowDate)}, checking could reach {money(p.impact.after.fundingLow)} — {money(Math.max(0, p.impact.cushion - p.impact.after.fundingLow))} below the amount you keep in checking.</>}
          {' '}Review upcoming purchases or change a goal’s amount or date. This is a cash gap on that date, not another monthly fee.</>}</p>
    </>}
    <p className="fine">Assumes you follow these budgets and expected income arrives. Lower spending is not confirmed savings.</p>
    <button className="btn" type="button" disabled={disabled || !p.hasChanges || !p.canApply} onClick={onConfirm}>Confirm budget &amp; savings changes</button>
    {!p.hasChanges && <p className="fine">No amounts have changed yet.</p>}
  </section>;
}
