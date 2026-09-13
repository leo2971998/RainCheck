import { Icon, Num, money, prettyIso, monthOf } from '../components/ui.jsx';
import { GoalChart } from '../components/charts.jsx';
import { BASE_GOAL, goalChoices } from '../engine/budget.js';
import { budgetMoney } from '../components/BudgetImpact.jsx';
import { PlanConnections } from '../components/GoalContext.jsx';

/**
 * A goal, the way a person states one: this much, by this date.
 *
 * The number of contributions is a consequence of that date, not the way the user expresses it,
 * so this page asks for a date and reports four separate things that used to blur together:
 *
 *   already saved        what is actually allocated
 *   required             what that date asks for
 *   supported            what the forecast can carry alongside the bills and the cushion
 *   projected            where the chosen plan actually lands
 */
export default function GoalsPage({ h, base, plan, change, cap, goal, history, onUndo, open,
  transfer = { available: false, status: null, request: () => {} } }) {
  const lastAction = history?.[history.length - 1];
  const transferring = transfer.pending || transfer.status === 'requested';
  const activeId = plan.goalId || BASE_GOAL;
  const alternatives = goalChoices(base, plan).filter(g => g.id !== activeId);

  return (
    <>
      <div className="topbar">
        <div><h1>{h.goal.label}</h1>
          <div className="sub">{money(h.goal.saved)} saved toward {money(h.goal.target)} by {monthOf(h.goal.targetDate)}</div></div>
        <div className="row wrap budget-actions">
          <button className="btn ghost sm" onClick={() => open('goal', activeId)}><Icon n="edit" s={14} />Edit goal</button>
          <button className="btn sm" onClick={() => open('goal')}>Add a goal</button>
        </div>
      </div>

      <div className="card budget-library">
        <div className="hd"><h2>Your active goal</h2><span className="pill teal">One goal at a time</span></div>
        <p>{h.goal.label} uses the savings shown below. Other ideas do not change your budget until you choose one.</p>
        <PlanConnections open={open} />
        {alternatives.length > 0 && <details><summary>Other goals ({alternatives.length})</summary>
          <ul className="budget-list">{alternatives.map(g => <li key={g.id}>
            <div><b>{g.label}</b><span className="fine">{budgetMoney(g.target)} by {prettyIso(g.targetDate)} · not funded separately</span></div>
            <button className="btn ghost sm" onClick={() => open('goal', g.id)}>Explore</button>
          </li>)}</ul>
        </details>}
      </div>

      <div className="grid g32">
        <div className="grid" style={{ gap: 18 }}>

          <div className="card">
            <div className="hd">
              <h2>Can this plan reach the goal?</h2>
              <span className={'pill ' + (goal.onTarget && goal.fits ? 'good' : 'warn')}>
                {!goal.fits ? 'Checking needs attention' : goal.gap ? `${money(goal.gap)} short by that date` : 'On track in this estimate'}
              </span>
            </div>

            {!goal.fits && <div className="alert"><b>Your planned saving does not fit the available cash.</b>
              <p>Planning to save {budgetMoney(goal.contribution)}/month can still make the savings total look high. That is not affordable if checking falls below your cushion. Edit the goal or compare adjustments before using this plan.</p></div>}

            <div className="grid g4" style={{ gap: 10 }}>
              <Measure label="Already saved" value={<Num v={goal.saved} />} sub="Actually in the account" />
              <Measure label="That date asks for" value={Number.isFinite(goal.required) ? <><Num v={goal.required} />/mo</> : 'No payday before deadline'} sub={`${goal.left} contribution${goal.left === 1 ? '' : 's'}`} />
              <Measure label="Your plan can carry" value={<><Num v={goal.supported} />/mo</>} sub="Alongside bills and cushion"
                tone={goal.feasible ? 'good' : 'bad'} />
              <Measure label="Projected result" value={<Num v={goal.projected} />} sub={goal.onTarget ? 'Reaches the target' : `${money(goal.gap)} short`} />
            </div>

            <div className={'alert ' + (goal.feasible ? 'good' : '')}>
              <b>{!Number.isFinite(goal.required) ? 'Choose a deadline after your next expected payday.' : goal.feasible
                ? `Your plan carries the ${money(goal.required)} a month this date asks for.`
                : `This date asks for ${money(goal.required)} a month. Your bills and your ${money(h.cushion)} cushion leave room for ${money(goal.supported)}.`}</b>
              <p>{goal.assumption}</p>
            </div>

            {goal.left > 0 && <GoalChart h={h} goal={goal} cap={goal.contribution} />}
          </div>

          {!goal.feasible && Number.isFinite(goal.required) && (
            <div className="card">
              <div className="hd"><h2>Two ways forward</h2><span className="fine">Both are real; neither is free</span></div>

              <div className="grid g2" style={{ gap: 12 }}>
                <div className="option">
                  <span className="move">Keep the date</span>
                  <h3>Find {money(goal.required - goal.supported)} more a month</h3>
                  <p>Reaches {money(h.goal.target)} by {monthOf(goal.targetDate)}, but only if something else gives:
                     an everyday allowance you have not protected, or a commitment you cancel.</p>
                  <button className="btn sm" onClick={() => open('compare')}>See what could give <Icon n="arrow" s={14} /></button>
                </div>

                <div className="option">
                  <span className="move">Keep the spending</span>
                  <h3>Reach it {goal.keepSpending?.date ? `by ${monthOf(goal.keepSpending.date)}` : 'later'}</h3>
                  <p>Contribute {money(goal.supported)} a month, which your plan already carries.
                     {goal.keepSpending?.months ? ` That is ${goal.keepSpending.months} contributions instead of ${goal.left}.` : ''}
                     {' '}Nothing else changes.</p>
                  <button className="btn sm ghost"
                    onClick={() => change({ goalDate: goal.keepSpending?.date, contribution: goal.supported }, `Target moved to ${monthOf(goal.keepSpending?.date)}`)}
                    disabled={!goal.keepSpending?.date}>Move the date <Icon n="arrow" s={14} /></button>
                </div>
              </div>

              <div className="fine">
                A plan that reaches the goal but leaves checking short is not a success. A plan that protects
                checking by taking longer can be the right answer, as long as the delay is visible.
              </div>
            </div>
          )}

          <div className="card">
            <div className="hd"><h2>Contribution schedule</h2>
              <span className="fine">Your planned contribution · {budgetMoney(goal.contribution)}/month</span></div>
            {/* A timeline rather than a table, with every date and amount still written on its node,
                so the shape of the plan is visible without losing the figures a table gave. */}
            <div className="scroll-x">
              <ol className="timeline" aria-label="Contribution schedule" style={{ '--n': goal.schedule.length }}>
                {goal.schedule.map((iso, i) => (
                  <li key={iso} className="tl-node" style={{ '--i': i }}>
                    <b className="tl-amt num">{money(goal.contribution)}</b>
                    <span className="tl-dot" aria-hidden="true" />
                    <span className="tl-date">{prettyIso(iso)}</span>
                    <span className="tl-n">{i + 1} of {goal.left}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="fine">
              {goal.checkedThrough ? `Every expected bill and paycheck through ${prettyIso(goal.checkedThrough)} was checked against this contribution. These are estimates, not guaranteed balances.` : 'There is no scheduled contribution before this deadline.'}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => open('compare')}>Compare options</button>
              {lastAction && <><span className="pill good"><Icon n="check" s={11} />{lastAction.label}</span>
                <button className="link" style={{ fontSize: 13 }} onClick={onUndo}>Undo</button></>}
            </div>
          </div>
        </div>

        <div className="grid" style={{ gap: 18 }}>
          <div className="card">
            <div className="hd"><h2>Savings account</h2><span className="pill neutral">Practice account</span></div>
            <div className="row between"><span className="muted">Recorded balance</span>
              <b className="num" style={{ fontSize: 22, fontFamily: 'var(--display)' }}>{money(h.savings)}</b></div>
            <div className="fine">Counted toward one goal. Accepting a plan never moves money.</div>

            <button className="btn ghost" disabled={!transfer.available || transferring || !(goal.contribution > 0)} onClick={() => transfer.request(goal.contribution)}>
              Try a {money(goal.contribution)} savings transfer
            </button>
            <div className="fine">Practice only — no real money moves.{!transfer.available && ' Transfers are unavailable in this workspace.'}</div>
            {transferring && <div className="alert"><b>Transfer requested</b><p>Waiting for confirmation before showing it as recorded.</p></div>}
            {transfer.status === 'completed' && !transferring && (
              <div className="alert good"><b><Icon n="check" s={13} /> Practice transfer recorded</b>
                <p>{money(transfer.result?.amount ?? goal.contribution)} recorded on {transfer.result?.date}. Practice account balances do not update automatically.</p></div>
            )}
            {transfer.error && (
              <div className="alert bad">
                <b>{transfer.halfCompleted ? 'The practice transfer is only partly recorded' : 'Transfer could not be confirmed'}</b>
                <p>{transfer.error}</p>
              </div>
            )}
          </div>

          <div className="card">
            <h2>Cushion</h2>
            <div className="row between"><span className="muted">Keep checking above</span><b className="num">{money(h.cushion)}</b></div>
            <div className="fine">Every status in the app comes from this number and the projected balance, never a score.</div>
          </div>
        </div>
      </div>
    </>
  );
}

function Measure({ label, value, sub, tone }) {
  return (
    <div className="card kpi measure" style={{ gap: 4, padding: '14px 16px' }}>
      <span className="l">{label}</span>
      <div className="v" style={{ fontSize: 21, color: tone === 'bad' ? 'var(--bad)' : tone === 'good' ? 'var(--good)' : undefined }}>{value}</div>
      <div className="s">{sub}</div>
    </div>
  );
}
