import { useMemo } from 'react';
import { Icon } from './ui.jsx';
import { BASE_GOAL, goalChoices } from '../engine/budget.js';
import { currentFunding } from '../engine/goal-funding.js';
import { goalMath, combinedMath } from '../engine/savings-schedule.js';
import { budgetMoney as money, budgetDate } from './BudgetImpact.jsx';

const pct = n => Math.round(n * 100);

/** Each goal keeps its own progress and deadline. Changes belong in the edit preview. */
export default function SavingsGoals({ h, base, plan, goal, open }) {
  const funding = currentFunding(base, plan);
  // Older saved plans return one calculated goal rather than a goals/payments collection.
  // Adapt that shape for display only; an explicit empty collection must stay empty.
  const goals = useMemo(() => goal.goals ?? [{ ...h.goal, ...goal, id: plan.goalId || BASE_GOAL }],
    [goal, h.goal, plan.goalId]);
  const math = useMemo(() => goalMath({ goals }), [goals]);
  const combined = useMemo(() => combinedMath(goal, math), [goal, math]);
  const paused = goalChoices(base, plan).filter(g => !goals.some(active => active.id === g.id));

  return <section className="spending-panel spending-goals" aria-label="Savings goals">
    <header className="spending-panel-heading">
      <span className="spending-panel-icon"><Icon n="target" s={20} /></span>
      <h2>Savings goals</h2>
      <button className="btn ghost sm goal-add" onClick={() => open('goal')}><Icon n="plus" s={14} />Add a goal</button>
    </header>

    <div className="goal-rows">
      <div className="goal-row goal-row-head">
        <span>Goal</span><span>Progress</span><span>Deadline</span>
        <span className="r">Saved</span><span className="r">Needs / month</span><span />
      </div>
      {math.map(g => {
        return <div className={'goal-row' + (g.onTrack ? '' : ' is-behind')} key={g.id}>
          <span className="goal-row-name"><b>{g.label}</b><small>Target {money(g.target)}</small></span>
          <span className="goal-row-progress">
            <progress value={g.saved} max={Math.max(g.target, 1)} aria-label={`${g.label} progress`} />
            <small>{pct(g.progress)}%</small></span>
          <span className="goal-row-when" aria-label={`Deadline ${budgetDate(g.targetDate)}`}><b>{budgetDate(g.targetDate)}</b>
            {g.done ? <small>Fully saved</small>
              : g.needed == null ? <small className="is-late">Choose a later deadline</small> : null}</span>
          <span className="r num goal-row-saved" aria-label={`Saved ${money(g.saved)}`}>{money(g.saved)}</span>
          <span className="r num goal-row-need" aria-label={g.needed == null ? 'Monthly amount unavailable' : `Needs ${money(g.needed)} per month`}>
            {g.needed == null ? '—' : <>{money(g.needed)}<small>/mo</small></>}</span>
          <span className="goal-row-do">
            <button className="btn ghost sm" aria-label={`Edit ${g.label}`} onClick={() => open('goal', g.id)}>Edit</button></span>
        </div>;
      })}
      {!math.length && <p className="savings-empty">No active goals. Add a goal or resume a paused one.</p>}
    </div>

    {combined.affordable === false && <p className="goal-note">
      These deadlines need {money(combined.needed)}/month; your plan has room for {money(combined.supported)}/month.{' '}
      <button className="link" onClick={() => open('compare')}>Review budgets</button></p>}

    {paused.length > 0 && <ul className="goal-paused">{paused.map(g => <li key={g.id}>
      <b>{g.label}</b><span>paused · {money(funding[g.id]?.saved || 0)} reserved</span>
      <button className="link" onClick={() => open('goal', g.id)}>Review</button></li>)}</ul>}

  </section>;
}
