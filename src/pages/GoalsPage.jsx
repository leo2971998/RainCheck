import { useState } from 'react';
import { Icon, Num, money, prettyIso, monthOf } from '../components/ui.jsx';
import { GoalChart } from '../components/charts.jsx';

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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ target: h.goal.target, targetDate: h.goal.targetDate });
  const lastAction = history?.[history.length - 1];
  const transferring = transfer.pending || transfer.status === 'requested';
  const edited = plan.goalTarget != null || plan.goalDate != null;

  const save = () => {
    const target = Math.max(1, Math.round(Number(draft.target) || 0));
    const targetDate = draft.targetDate || h.goal.targetDate;
    change({ goalTarget: target, goalDate: targetDate }, `Goal set to ${money(target)} by ${prettyIso(targetDate)}`);
    setEditing(false);
  };
  const reset = () => { change({ goalTarget: null, goalDate: null }, 'Goal reset'); setEditing(false); };

  return (
    <>
      <div className="topbar">
        <div><h1>{h.goal.label}</h1>
          <div className="sub">{money(h.goal.saved)} saved toward {money(h.goal.target)} by {monthOf(h.goal.targetDate)}</div></div>
        {editing
          ? <div className="row" style={{ gap: 8 }}><button className="btn" onClick={save}><Icon n="check" s={15} />Save goal</button><button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button></div>
          : <div className="row" style={{ gap: 8 }}>
              {edited && <button className="btn ghost sm" onClick={reset}>Reset goal</button>}
              <button className="btn ghost sm" onClick={() => { setDraft({ target: h.goal.target, targetDate: h.goal.targetDate }); setEditing(true); }}><Icon n="edit" s={14} />Edit goal</button>
            </div>}
      </div>

      <div className="grid g32">
        <div className="grid" style={{ gap: 18 }}>

          <div className="card">
            <div className="hd">
              <h2>Can this plan reach the goal?</h2>
              <span className={'pill ' + (goal.feasible ? 'good' : 'bad')}>
                {goal.feasible ? 'Yes, by that date' : `${money(goal.gap)} short by that date`}
              </span>
            </div>

            {editing && (
              <div className="alert">
                <b>What are you saving for, and by when?</b>
                <div className="row wrap" style={{ gap: 14, marginTop: 4 }}>
                  <label className="row" style={{ gap: 8 }}><span className="muted">Target</span>
                    <input type="number" min="1" step="50" value={draft.target} aria-label="Goal amount"
                      onChange={e => setDraft(d => ({ ...d, target: e.target.value }))} /></label>
                  <label className="row" style={{ gap: 8 }}><span className="muted">By</span>
                    <input type="date" value={draft.targetDate} aria-label="Target date"
                      onChange={e => setDraft(d => ({ ...d, targetDate: e.target.value }))} /></label>
                </div>
                <p>Already saved {money(h.goal.saved)}. Contributions land on your payday each month.</p>
              </div>
            )}

            <div className="grid g4" style={{ gap: 10 }}>
              <Measure label="Already saved" value={<Num v={goal.saved} />} sub="Actually in the account" />
              <Measure label="That date asks for" value={<><Num v={goal.required} />/mo</>} sub={`${goal.left} contribution${goal.left === 1 ? '' : 's'}`} />
              <Measure label="Your plan can carry" value={<><Num v={goal.supported} />/mo</>} sub="Alongside bills and cushion"
                tone={goal.feasible ? 'good' : 'bad'} />
              <Measure label="Projected result" value={<Num v={goal.projected} />} sub={goal.onTarget ? 'Reaches the target' : `${money(goal.gap)} short`} />
            </div>

            <div className={'alert ' + (goal.feasible ? 'good' : '')}>
              <b>{goal.feasible
                ? `Your plan carries the ${money(goal.required)} a month this date asks for.`
                : `This date asks for ${money(goal.required)} a month. Your bills and your ${money(h.cushion)} cushion leave room for ${money(goal.supported)}.`}</b>
              <p>{goal.assumption}</p>
            </div>

            <GoalChart h={h} goal={goal} cap={goal.contribution} />
          </div>

          {!goal.feasible && (
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
              <span className="fine">{goal.accepted ? 'The plan you accepted' : 'The affordable plan'}</span></div>
            <table><tbody>{goal.schedule.map((iso, i) => (
              <tr key={iso}>
                <td style={{ paddingLeft: 0 }} className="muted">{prettyIso(iso)}</td>
                <td>Contribution {i + 1} of {goal.left}</td>
                <td className="r" style={{ paddingRight: 0 }}><b>{money(goal.contribution)}</b></td>
              </tr>
            ))}</tbody></table>
            <div className="fine">
              Every bill and paycheck between now and {prettyIso(goal.checkedThrough)} was checked against this
              contribution, not just the next few weeks.
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
            <div className="hd"><h2>Savings account</h2><span className="pill teal">{transfer.available ? 'Nessie sandbox' : 'Sandbox not connected'}</span></div>
            <div className="row between"><span className="muted">Actual balance</span>
              <b className="num" style={{ fontSize: 22, fontFamily: 'var(--display)' }}>{money(h.savings)}</b></div>
            <div className="fine">Counted toward one goal. Accepting a plan never moves money.</div>

            <button className="btn ghost" disabled={!transfer.available || transferring} onClick={() => transfer.request(goal.contribution)}>
              Move {money(goal.contribution)} to savings (sandbox)
            </button>
            {!transfer.available && <div className="fine">Connect the Nessie sandbox to move money.</div>}
            {transferring && <div className="alert"><b>Transfer requested</b><p>Waiting to read its status back from the sandbox before showing it as complete.</p></div>}
            {transfer.status === 'completed' && !transferring && (
              <div className="alert good"><b><Icon n="check" s={13} /> Completed · confirmed by the sandbox</b>
                <p>{money(transfer.result?.amount ?? goal.contribution)} recorded on {transfer.result?.date}. {transfer.result?.balanceNote}</p></div>
            )}
            {transfer.error && (
              <div className="alert bad">
                <b>{transfer.halfCompleted ? 'The money left checking but did not arrive' : 'Transfer could not be confirmed'}</b>
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
    <div className="card kpi" style={{ gap: 4, padding: '14px 16px' }}>
      <span className="l">{label}</span>
      <div className="v" style={{ fontSize: 21, color: tone === 'bad' ? 'var(--bad)' : tone === 'good' ? 'var(--good)' : undefined }}>{value}</div>
      <div className="s">{sub}</div>
    </div>
  );
}
