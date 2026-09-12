import { Icon, money } from '../components/ui.jsx';
import { GoalChart } from '../components/charts.jsx';

export default function GoalsPage({ h, sc, cap, goal, applied, open, transfer = { available: false, status: null, request: () => {} } }) {
  const transferring = transfer.pending || transfer.status === 'requested';
  return (
    <>
      <div className="topbar"><div><h1>Goals</h1><div className="sub">Actual progress, contribution plan, and projected outcome</div></div><button className="btn ghost sm" disabled title="New goals are not available in this demo">+ New goal</button></div>
      <div className="grid g32">
        <div className="grid" style={{ gap: 18 }}>
          <div className="card">
            <div className="hd"><div className="cat"><i className="rec"><Icon n="shield" s={14} /></i><h2>{h.goal.label} · {money(h.goal.target)} by {goal.targetLabel}</h2></div><span className={'pill ' + (goal.gap ? 'bad' : 'good')}>{goal.gap ? `${money(goal.gap)} short` : 'On track'}</span></div>
            <div className="progress"><i className="proj" style={{ width: Math.min(100, goal.projected / h.goal.target * 100) + '%' }}></i><i className="saved" style={{ width: h.goal.saved / h.goal.target * 100 + '%' }}></i></div>
            <div className="row between fine"><span><span className="dot" style={{ background: 'var(--accent)' }}></span> Saved {money(h.goal.saved)}</span><span><span className="dot" style={{ background: 'var(--cloud-deep)' }}></span> Projected {money(goal.projected)}</span><span>Target {money(h.goal.target)}</span></div>
            <GoalChart h={h} goal={goal} cap={applied ? sc.contribution : cap} />
            <table><thead><tr><th>Plan</th><th className="r">Original</th><th className="r">Updated</th></tr></thead><tbody>
              <tr><td>Already saved</td><td className="r">{money(h.goal.saved)}</td><td className="r">{money(h.goal.saved)}</td></tr>
              <tr><td>Required contribution for the date</td><td className="r">{money((h.goal.target - h.goal.saved) / h.goal.left)}</td><td className="r">{money((h.goal.target - h.goal.saved) / h.goal.left)}</td></tr>
              <tr><td>Contribution the plan can support</td><td className="r">{money(h.goal.planned)}</td><td className="r"><b>{money(cap)}</b></td></tr>
              <tr><td>{goal.left} future contributions</td><td className="r">{money(h.goal.planned * h.goal.left)}</td><td className="r">{money(goal.contributions)}</td></tr>
              <tr><td>Projected balance</td><td className="r">{money(h.goal.target)}</td><td className="r"><b>{money(goal.projected)}</b></td></tr>
              <tr><td>Gap at target date</td><td className="r">$0</td><td className="r"><b style={{ color: goal.gap ? 'var(--bad)' : 'var(--good)' }}>{money(goal.gap)}</b></td></tr>
            </tbody></table>
            <div className="row" style={{ gap: 8 }}><button className="btn" onClick={() => open('compare')}>Compare options</button>{applied && <span className="pill good"><Icon n="check" s={11} />{applied.label}</span>}</div>
          </div>
        </div>
        <div className="grid" style={{ gap: 18 }}>
          <div className="card"><div className="hd"><h2>Savings account</h2><span className="pill teal">{transfer.available ? 'Nessie sandbox' : 'Sandbox not connected'}</span></div><div className="row between"><span className="muted">Actual balance</span><b className="num" style={{ fontSize: 22, fontFamily: 'var(--display)' }}>{money(h.savings)}</b></div><div className="fine">Counted toward one goal. Accepting a plan never moves money.</div>
            <button className="btn ghost" disabled={!transfer.available || transferring} onClick={() => transfer.request(sc.contribution)}>Move {money(sc.contribution)} to savings (sandbox)</button>
            {!transfer.available && <div className="fine">Connect the Nessie sandbox to test transfers</div>}
            {transferring && <div className="alert"><b>Transfer requested</b><p>Waiting to read back its status from the sandbox before showing it as complete.</p></div>}
            {transfer.status && !transferring && <span className={'pill ' + (transfer.status === 'completed' ? 'good' : 'neutral')}>{transfer.status === 'completed' ? <><Icon n="check" s={11} />Completed · confirmed by the sandbox</> : transfer.status}</span>}
            {transfer.error && <div className="alert bad"><b>Transfer could not be confirmed</b><p>{transfer.error}</p></div>}</div>
          <div className="card"><h2>Contribution schedule</h2><table><tbody>{h.goal.months.map((m, i) => <tr key={m}><td style={{ paddingLeft: 0 }} className="muted">{m}</td><td>Contribution {i + 1} of {goal.left}</td><td className="r" style={{ paddingRight: 0 }}><b>{money(sc.contribution)}</b></td></tr>)}</tbody></table></div>
          <div className="card"><h2>Cushion</h2><div className="row between"><span className="muted">Keep checking above</span><b className="num">{money(h.cushion)}</b></div><div className="fine">Every status on the dashboard comes from this number and the projected balance.</div></div>
        </div>
      </div>
    </>
  );
}
