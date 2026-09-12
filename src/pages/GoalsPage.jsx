import { useState } from 'react';
import { Icon, money, prettyIso, monthOf } from '../components/ui.jsx';
import { GoalChart } from '../components/charts.jsx';
import { goalAt } from '../engine/forecast.js';

export default function GoalsPage({ h, base, plan, change, cap, goal, history, onUndo, open,
  transfer = { available: false, status: null, request: () => {} } }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ target: h.goal.target, left: h.goal.left });
  const lastAction = history?.[history.length - 1];
  // The 'Original' column is the household's own plan, calculated the same way as the updated one.
  // It used to print the target as the projected balance and hardcode the gap to zero, so a
  // $5,000 goal showed $800 saved, $1,200 of contributions and a $5,000 result.
  const original = goalAt(base, base.goal.planned, base.goal.left);
  const transferring = transfer.pending || transfer.status === 'requested';

  // What the date would demand, against what the plan can actually carry.
  const required = h.goal.left > 0 ? (h.goal.target - h.goal.saved) / h.goal.left : 0;
  const feasible = cap >= required;

  const save = () => {
    const target = Math.max(1, Math.round(Number(draft.target) || 0));
    const left = Math.min(24, Math.max(1, Math.round(Number(draft.left) || 1)));
    change({ goalTarget: target, goalLeft: left }, `Goal set to ${target} over ${left} contributions`);
    setEditing(false);
  };
  const reset = () => { change({ goalTarget: null, goalLeft: null }, 'Goal reset'); setDraft({ target: base.goal.target, left: base.goal.left }); setEditing(false); };

  return (
    <>
      <div className="topbar">
        <div><h1>Goals</h1><div className="sub">Actual progress, contribution plan, and projected outcome</div></div>
        {editing
          ? <div className="row" style={{ gap: 8 }}><button className="btn" onClick={save}><Icon n="check" s={15} />Save goal</button><button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button></div>
          : <div className="row" style={{ gap: 8 }}>
              {(plan.goalTarget != null || plan.goalLeft != null) && <button className="btn ghost sm" onClick={reset}>Reset goal</button>}
              <button className="btn ghost sm" onClick={() => { setDraft({ target: h.goal.target, left: h.goal.left }); setEditing(true); }}><Icon n="edit" s={14} />Edit goal</button>
            </div>}
      </div>

      <div className="grid g32">
        <div className="grid" style={{ gap: 18 }}>
          <div className="card">
            <div className="hd">
              <div className="cat"><i className="rec"><Icon n="shield" s={14} /></i><h2>{h.goal.label} · {money(h.goal.target)} by {goal.targetLabel}</h2></div>
              <span className={'pill ' + (goal.gap ? 'bad' : 'good')}>{goal.gap ? `${money(goal.gap)} short` : 'On track'}</span>
            </div>

            {editing && (
              <div className="alert">
                <b>What are you saving for, and by when?</b>
                <div className="row wrap" style={{ gap: 14, marginTop: 4 }}>
                  <label className="row" style={{ gap: 8 }}><span className="muted">Target</span>
                    <input type="number" min="1" step="50" value={draft.target} aria-label="Goal amount"
                      onChange={e => setDraft(d => ({ ...d, target: e.target.value }))} /></label>
                  <label className="row" style={{ gap: 8 }}><span className="muted">Over</span>
                    <input type="number" min="1" max="24" step="1" value={draft.left} aria-label="Number of monthly contributions"
                      onChange={e => setDraft(d => ({ ...d, left: e.target.value }))} /><span className="muted">monthly contributions</span></label>
                </div>
                <p>That asks for {money(Math.max(0, (Number(draft.target) - h.goal.saved) / Math.max(1, Number(draft.left))))} a month. Your plan currently supports {money(cap)}.</p>
              </div>
            )}

            <div className="progress">
              <i className="proj" style={{ width: Math.min(100, goal.projected / h.goal.target * 100) + '%' }}></i>
              <i className="saved" style={{ width: Math.min(100, h.goal.saved / h.goal.target * 100) + '%' }}></i>
            </div>
            <div className="row between fine">
              <span><span className="dot" style={{ background: 'var(--accent)' }}></span> Saved {money(h.goal.saved)}</span>
              <span><span className="dot" style={{ background: '#C7CBE0' }}></span> Projected {money(goal.projected)}</span>
              <span>Target {money(h.goal.target)}</span>
            </div>

            <GoalChart h={h} goal={goal} cap={goal.contribution} />

            <table>
              <thead><tr><th>Plan</th>
                <th className="r">Original<div className="fine">{money(base.goal.target)} by {monthOf(original.schedule[original.schedule.length - 1])}</div></th>
                <th className="r">Updated<div className="fine">{money(h.goal.target)} by {goal.targetLabel}</div></th></tr></thead>
              <tbody>
                <tr><td>Already saved</td><td className="r">{money(h.goal.saved)}</td><td className="r">{money(h.goal.saved)}</td></tr>
                <tr><td>Required contribution for the date</td><td className="r">{money((base.goal.target - base.goal.saved) / base.goal.left)}</td><td className="r">{money(required)}</td></tr>
                <tr><td>Contribution used</td><td className="r">{money(original.contribution)}</td><td className="r"><b>{money(goal.contribution)}</b></td></tr>
                <tr><td>Future contributions</td><td className="r">{money(original.contributions)}<div className="fine">{original.left} contributions</div></td><td className="r">{money(goal.contributions)}<div className="fine">{goal.left} contributions</div></td></tr>
                <tr><td>Projected balance</td><td className="r">{money(original.projected)}</td><td className="r"><b>{money(goal.projected)}</b></td></tr>
                <tr><td>Gap at target date</td><td className="r"><b style={{ color: original.gap ? 'var(--bad)' : 'var(--good)' }}>{money(original.gap)}</b></td><td className="r"><b style={{ color: goal.gap ? 'var(--bad)' : 'var(--good)' }}>{money(goal.gap)}</b></td></tr>
              </tbody>
            </table>

            <div className="alert">
              <b>This total is a projection, not a checked schedule.</b>
              <p>{goal.assumption}</p>
            </div>

            <div className="fine">
              {feasible
                ? `Your plan carries the ${money(required)} this date asks for.`
                : `This date asks for ${money(required)} a month. Your bills and cushion leave room for ${money(cap)}, so something has to give: the date, the target, or an everyday allowance.`}
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => open('compare')}>Compare options</button>
              {lastAction && <><span className="pill good"><Icon n="check" s={11} />{lastAction.label}</span><button className="link" style={{ fontSize: 13 }} onClick={onUndo}>Undo</button></>}
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
            {transfer.status && !transferring && (
              transfer.status === 'completed'
                ? <div className="alert good"><b><Icon n="check" s={13} /> Completed · confirmed by the sandbox</b>
                    <p>{money(transfer.result?.amount ?? goal.contribution)} recorded on {transfer.result?.date}. {transfer.result?.balanceNote}</p></div>
                : <span className="pill neutral">{transfer.status}</span>
            )}
            {transfer.error && <div className="alert bad"><b>Transfer could not be confirmed</b><p>{transfer.error}</p></div>}
          </div>

          <div className="card">
            <h2>Contribution schedule</h2>
            <table><tbody>{goal.schedule.map((iso, i) => (
              <tr key={iso}><td style={{ paddingLeft: 0 }} className="muted">{prettyIso(iso)}</td>
                <td>Contribution {i + 1} of {goal.left}</td>
                <td className="r" style={{ paddingRight: 0 }}><b>{money(goal.contribution)}</b></td></tr>
            ))}</tbody></table>
            <div className="fine">
              {goal.accepted
                ? 'The plan you accepted.'
                : `The affordable plan: ${money(goal.contribution)} a month, not the ${money(h.goal.planned)} originally scheduled. Accept an option to make it yours.`}
              {' '}Dates come from the goal itself, so they always match the count.
            </div>
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
