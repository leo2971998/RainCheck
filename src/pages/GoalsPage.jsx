import { Icon } from '../components/ui.jsx';
import { BASE_GOAL, goalChoices } from '../engine/budget.js';
import { currentFunding } from '../engine/goal-funding.js';
import { budgetMoney as money, budgetDate } from '../components/BudgetImpact.jsx';
import { PlanConnections } from '../components/GoalContext.jsx';
import { GoalRing } from '../components/GoalRing.jsx';

export default function GoalsPage({ h, base, plan, goal, history, onUndo, open,
  transfer = { available: false, status: null, request: () => {} } }) {
  const lastAction = history?.at(-1);
  const funding = currentFunding(base, plan);
  const goals = goal.goals ?? [{ ...h.goal, ...goal, id: plan.goalId || BASE_GOAL }];
  const paused = goalChoices(base, plan).filter(g => !goals.some(active => active.id === g.id));
  const allocated = Object.values(funding).filter(Boolean).reduce((s, f) => s + f.saved, 0);
  const payments = goal.payments ?? goal.schedule.map(date => ({ date, label: h.goal.label, amount: goal.contribution }));
  const nextDate = payments[0]?.date;
  const nextAmount = payments.filter(p => p.date === nextDate).reduce((s, p) => s + p.amount, 0);
  const transferring = transfer.pending || transfer.status === 'requested';

  return <>
    <div className="topbar">
      <div><h1>Your goals</h1><div className="sub">Different goals. One shared budget.</div></div>
      <button className="btn" onClick={() => open('goal')}><Icon n="plus" s={15} />Add a goal</button>
    </div>
    <section className="card goal-overview" aria-label="Shared savings plan">
      <div className="hd"><h2>Total monthly saving</h2><span className={'pill ' + (goal.fits && !goal.gap ? 'good' : 'warn')}>
        {!goal.fits ? 'Budget needs attention' : !goals.length ? 'Ready to plan' : goal.gap ? 'Some goals need more time or saving' : 'On track in this estimate'}</span></div>
      <div className="goal-total num">{money(goal.contribution)}<span>/month</span></div>
      <p>Across {goals.length} {goals.length === 1 ? 'goal' : 'goals'}, after expected bills and everyday spending.</p>
      {!goal.fits && <div className="alert"><b>These contributions do not all fit the forecast.</b>
        <p>Review a goal’s monthly amount or deadline, or compare spending changes. Nothing is reduced automatically.</p>
        <button className="btn ghost sm" onClick={() => open('compare')}>Compare spending changes</button></div>}
      {goal.gap > 0 && <p className="fine">The scheduled contributions leave a combined {money(goal.gap)} shortfall. Check each goal’s deadline below.</p>}
      <PlanConnections open={open} />
      {lastAction && <div className="row wrap"><span className="fine">{lastAction.label}</span><button className="link" onClick={onUndo}>Undo</button></div>}
    </section>

    <h2 className="zone">Saving toward</h2>
    <div className="grid g2 goal-cards">
      {goals.map(g => <section className="card" key={g.id} aria-label={g.label + ' savings goal'}>
        <div className="hd"><h2>{g.label}</h2><span className={'pill ' + (g.saved >= g.target ? 'good' : g.gap ? 'warn' : 'teal')}>
          {g.saved >= g.target ? 'Fully saved' : g.gap ? 'Needs adjustment' : 'Planned'}</span></div>
        <div className="row goal-progress">
          <GoalRing saved={g.saved} target={g.target} projected={g.projected} />
          <div><strong className="goal-monthly num">{money(g.contribution)}/mo</strong>
            <p className="fine">{money(g.saved)} saved of {money(g.target)}<br />By {budgetDate(g.targetDate)}</p></div>
        </div>
        <p>Projected: <b>{money(g.projected)}</b>{g.gap ? ' · ' + money(g.gap) + ' short' : ' · reaches the target'}.</p>
        {g.required != null && g.gap > 0 && <p className="fine">That deadline needs about {money(g.required)}/month for this goal. Check the combined budget before increasing it.</p>}
        <button className="btn ghost sm" onClick={() => open('goal', g.id)}>Edit {g.label.toLowerCase()}</button>
      </section>)}
      {!goals.length && <div className="card"><h3>No goals receiving contributions</h3><p>Add a goal or resume one below. Your savings stay in the account.</p></div>}
    </div>

    {paused.length > 0 && <section className="card budget-library"><h2>Paused &amp; saved for later</h2>
      <ul className="budget-list">{paused.map(g => <li key={g.id}><div><b>{g.label}</b><span className="fine">{money(funding[g.id]?.saved || 0)} reserved · no monthly contributions</span></div>
        <button className="btn ghost sm" onClick={() => open('goal', g.id)}>Review {g.label.toLowerCase()}</button></li>)}</ul>
    </section>}

    <div className="grid g2" style={{ marginTop: 18 }}>
      <section className="card"><h2>One savings account</h2>
        <div className="row between"><span>Recorded balance</span><b>{money(h.savings)}</b></div>
        <div className="row between"><span>Already allocated across goals</span><b>{money(allocated)}</b></div>
        <div className="row between"><span>Not assigned to a goal</span><b>{money(h.savings - allocated)}</b></div>
        <p className="fine">Allocations include paused goals. Each dollar is assigned once. Accepting a plan does not move money.</p>
        <details><summary>Practice a savings transfer</summary>
          <p className="fine">Practice only — no real money moves. This does not update goal allocations or account balances automatically.</p>
          <button className="btn ghost" disabled={!transfer.available || transferring || !nextAmount} onClick={() => transfer.request(nextAmount)}>
            Try a {money(nextAmount)} savings transfer</button>
          {transferring && <p role="status">Waiting for confirmation…</p>}
          {transfer.status === 'completed' && !transferring && <p role="status">Practice transfer recorded: {money(transfer.result?.amount ?? nextAmount)}.</p>}
          {transfer.error && <p role="alert">{transfer.halfCompleted ? 'The practice transfer is partly recorded. ' : ''}{transfer.error}</p>}
        </details>
      </section>
      <section className="card"><h2>Plan details</h2>
        <details><summary>Checking safety buffer</summary>
          <p>Leave {money(h.cushion)} in checking for timing gaps and unexpected costs. This is separate from an emergency fund in savings.</p>
          <button className="btn ghost sm" onClick={() => open('checking-target')}>Edit checking buffer</button>
        </details>
        <details><summary>Monthly contribution schedule</summary>
          <p className="fine">Planned savings, not completed transfers. Each goal keeps its own deadline.</p>
          <ul className="budget-list">{[...new Set(payments.map(p => p.date))].map(date => <li key={date}>
            <div><b>{budgetDate(date)}</b><span className="fine">{payments.filter(p => p.date === date).map(p => p.label + ': ' + money(p.amount)).join(' · ')}</span></div>
            <b>{money(payments.filter(p => p.date === date).reduce((s, p) => s + p.amount, 0))}</b>
          </li>)}</ul>
          {!payments.length && <p>No contributions are scheduled before these deadlines.</p>}
        </details>
        <p className="fine">{goal.assumption}</p>
      </section>
    </div>
  </>;
}
