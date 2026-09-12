import { Icon, Kpi, STATE, money, prettyDate, longDate, prettyIso, weekdayIso } from '../components/ui.jsx';
import { AreaChart, GoalChart, CashBars } from '../components/charts.jsx';
import IncomeList from '../components/IncomeList.jsx';
import Alerts from '../components/Alerts.jsx';

/** Describes the gap between the first two expected paychecks in words, rather than assuming it. */
function cadenceWords(income) {
  if (income.length < 2) return 'month';
  const days = Math.round((new Date(income[1].date) - new Date(income[0].date)) / 864e5);
  return days <= 8 ? 'week' : days <= 16 ? 'two weeks' : days <= 24 ? 'three weeks' : 'month';
}

export default function Dashboard({ h, source, plan, change, sim, previewSim, preview, cap, goal, alerts, open, history, onUndo, found, setFound }) {
  const sc = plan;
  const lastAction = history?.[history.length - 1];
  const [st, tone] = STATE[sim.worst];
  const changedBills = h.recurring.filter(r => r.change);
  const unexplainedBills = h.recurring.filter(r => r.unexplained && !(sc.treatAsNewPrice && r.id in sc.treatAsNewPrice));
  const today = new Date(h.today + 'T12:00:00');
  const sourceLabel = { sample: 'Sample data', nessie: 'Nessie sandbox', snapshot: 'Saved sandbox snapshot' }[source];
  const nextPay = (sc.income || h.income)[0];
  const lastDay = sim.days[sim.days.length - 1];
  const reviewCount = h.recurring.filter(r => r.unexplained).length;
  const headline = sim.worst === 'over' ? 'Your balance would go below zero before payday.' : sim.worst === 'below' ? 'Bills are covered, but your savings plan dips below your cushion.' : goal.gap > 0 ? 'Bills are covered, but your goal needs an adjustment.' : 'Bills are covered and your goal is on track.';
  return (
    <>
      <div className="topbar"><div><h1>{headline}</h1><div className="sub">{longDate(today)}{nextPay ? ` · Next paycheck ${weekdayIso(nextPay.date)}` : ''} · Forecast through {prettyDate(lastDay.date)}</div></div>
        <div className="row"><span className="pill teal"><Icon n="bank" s={13} />{sourceLabel}</span><span className="pill neutral" title="Items needing attention"><Icon n="bell" s={13} />{alerts.filter(a => a.tone !== 'good').length}</span></div></div>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Kpi label="Checking balance" value={money(h.checking)} sub="Everyday Checking" />
        <Kpi label="Lowest projected balance" value={money(sim.low.balance)} sub={`${prettyDate(sim.low.date)} · cushion ${money(h.cushion)}`} pill={<span className={'pill ' + tone}>{st}</span>} />
        <Kpi label="Contribution the plan supports" value={`${money(cap)}/mo`} sub={`Planned ${money(h.goal.planned)} · ${cap < h.goal.planned ? `${money(h.goal.planned - cap)} less after the bill change` : 'unchanged'}`} pill={cap < h.goal.planned ? <span className="pill warn"><Icon n="down" s={11} />{money(h.goal.planned - cap)}</span> : <span className="pill good">OK</span>} />
        <Kpi label={h.goal.label} value={money(goal.projected)} sub={`Projected of ${money(h.goal.target)} by ${goal.targetLabel}`} pill={goal.gap ? <span className="pill bad">{money(goal.gap)} short</span> : <span className="pill good">On track</span>} />
      </div>
      <div className="grid g32">
        <div className="grid" style={{ gap: 18 }}>
          <div className="card">
            <div className="hd"><div><h2>Projected checking balance</h2><div className="fine">{preview ? `Dashed line: ${preview.title.toLowerCase()}. Solid line: your current plan.` : `Next ${h.windowDays} days · scheduled bills, expected income, everyday spending and your ${money(sc.contribution)} contribution`}</div></div>
              <div className="legend"><span><i style={{ background: '#4F46E5' }}></i>Balance</span><span><i style={{ background: '#0D9488', borderRadius: '50%' }}></i>Paycheck</span><span><i style={{ background: '#fff', border: '2px solid #4F46E5', borderRadius: '50%', width: 8, height: 8 }}></i>Bill ≥ $100</span><span><i style={{ background: '#D97706', height: 2, width: 14 }}></i>Cushion</span></div></div>
            <AreaChart h={h} sim={sim} preview={previewSim} id="dash" />
          </div>
          <div className="grid g2">
            <div className="card">
              <div className="hd"><h2>What changed</h2>
                {changedBills.length
                  ? <span className="pill warn"><Icon n="up" s={11} />{changedBills.length} increase detected</span>
                  : <span className="pill good"><Icon n="check" s={11} />No increases</span>}</div>
              {changedBills.map(bill => (
                <div className="row" style={{ alignItems: 'flex-start' }} key={bill.id}>
                  <div className="cat"><i className="rec"><Icon n="repeat" s={14} /></i></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{bill.label}</div>
                    <div className="fine">{money(bill.amount)} → <b className="num" style={{ color: 'var(--ink)' }}>{money(bill.amount + sc.increase)}</b> per month · takes effect {prettyIso(bill.change.effective)}</div>
                    <div className="fine">{sc.increase !== bill.change.increase ? `What-if scenario · the notice says ${money(bill.change.increase)}` : `${bill.change.why}, per the notice`}</div>
                  </div>
                </div>
              ))}
              {unexplainedBills.map(bill => (
                <div className="row" style={{ alignItems: 'flex-start' }} key={bill.id}>
                  <div className="cat"><i className="rev"><Icon n="warn" s={14} /></i></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{bill.label}</div>
                    <div className="fine">{money(bill.lastPosted)} posted against a usual {money(bill.usual ?? bill.amount)}</div>
                    <div className="fine">We have not confirmed why. Decide on the Recurring page.</div>
                  </div>
                </div>
              ))}
              {!changedBills.length && !unexplainedBills.length && <div className="fine">Every commitment posted the amount we expected.</div>}
              <div className="row wrap" style={{ gap: 8 }}>
                {changedBills.length > 0 && <button className="btn sm" onClick={() => open('bill')}>See what changed</button>}
                <button className="btn ghost sm" onClick={() => open('compare')}>Compare options</button>
                {unexplainedBills.length > 0 && <button className="btn ghost sm" onClick={() => open('page:recurring')}>Decide on {unexplainedBills.length === 1 ? unexplainedBills[0].label.toLowerCase() : 'these charges'}</button>}
              </div>
            </div>
            <div className="card">
              <div className="hd"><h2>{h.goal.label}</h2><span className={'pill ' + (goal.gap ? 'bad' : 'good')}>{goal.gap ? `${money(goal.gap)} short` : 'On track'}</span></div>
              <GoalChart h={h} goal={goal} cap={goal.contribution} />
              <div className="row between fine"><span>Saved <b className="num">{money(h.goal.saved)}</b> · projected <b className="num">{money(goal.projected)}</b></span><span>{goal.accepted ? 'Accepted plan' : 'Affordable plan'} <b className="num">{money(goal.contribution)}/mo</b></span></div>
              {lastAction && <span className="row" style={{ gap: 6 }}><span className="pill good"><Icon n="check" s={11} />{lastAction.label}</span><button className="link" style={{ fontSize: 13 }} onClick={onUndo}>Undo</button></span>}
            </div>
          </div>
          <div className="card">
            <div className="hd"><h2>Cash flow</h2><span className="fine">{lastDay.date.toLocaleDateString('en-US', { month: 'long' })} is projected from the forecast</span></div>
            <CashBars h={h} sim={sim} />
          </div>
        </div>
        <div className="grid" style={{ gap: 18 }}>
          {found && <div className="card" style={{ background: 'linear-gradient(135deg, #EEF0FF, #F6F7FB)' }}><div className="hd"><h2>Here is what we found</h2><button className="link" onClick={() => setFound(false)}>Dismiss</button></div>
            <div className="row wrap" style={{ gap: 6 }}><span className="pill good"><Icon n="check" s={11} />Paycheck about every {cadenceWords(h.income)}</span><span className="pill good"><Icon n="check" s={11} />{h.recurring.length} recurring commitments</span>{reviewCount > 0 && <span className="pill warn">{reviewCount} charge{reviewCount === 1 ? ' needs' : 's need'} review</span>}</div>
            <div><button className="btn ghost sm" onClick={() => open('page:transactions')}>Review my plan</button></div></div>}
          <Alerts alerts={alerts} open={open} />
          <IncomeList h={h} plan={plan} change={change} compact />
        </div>
      </div>
    </>
  );
}
