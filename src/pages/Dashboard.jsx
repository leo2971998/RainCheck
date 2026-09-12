import { Icon, Kpi, Num, STATE, money, prettyDate, longDate, prettyIso, weekdayIso } from '../components/ui.jsx';
import { AreaChart, CashBars } from '../components/charts.jsx';
import { Sky, Outlook, timeOfDay } from '../components/Weather.jsx';
import { GoalRing } from '../components/GoalRing.jsx';
import IncomeList from '../components/IncomeList.jsx';
import Alerts from '../components/Alerts.jsx';
import Reminders from '../components/Reminders.jsx';

/** Describes the gap between the first two expected paychecks in words, rather than assuming it. */
function cadenceWords(income) {
  if (income.length < 2) return 'month';
  const days = Math.round((new Date(income[1].date) - new Date(income[0].date)) / 864e5);
  return days <= 8 ? 'week' : days <= 16 ? 'two weeks' : days <= 24 ? 'three weeks' : 'month';
}

export default function Dashboard({ h, source, plan, sc, change, sim, previewSim, preview, cap, goal, alerts, waiting = [], onReviewNotice, reminders = [], leadDays = 3, setLeadDays, onPaid, open, history, onUndo, found, setFound }) {
  // The scenario, not the raw plan: an unaccepted plan has no contribution of its own and falls back
  // to the planned figure. Reading the plan here made the chart caption say "$0 contribution" beside
  // a line that was simulated at $300.
  const lastAction = history?.[history.length - 1];
  const [st, tone] = STATE[sim.worst];
  const changedBills = h.recurring.filter(r => r.change);
  const unexplainedBills = h.recurring.filter(r => r.unexplained && !(sc.treatAsNewPrice && r.id in sc.treatAsNewPrice));
  const today = new Date(h.today + 'T12:00:00');
  const sourceLabel = { sample: 'Sample data', nessie: 'Nessie sandbox', snapshot: 'Saved sandbox snapshot' }[source];
  const nextPay = (sc.income || h.income)[0];
  const lastDay = sim.days[sim.days.length - 1];
  const reviewCount = h.recurring.filter(r => r.unexplained).length;
  // The weather picture reports the same status as everything else. Decoration that always showed
  // sunshine would be the one part of the page that could not deliver bad news. The clock picks
  // only the sky behind it, so an evening never looks like a bad forecast.
  const tod = timeOfDay();
  const night = tod === 'night';
  const headline = sim.worst === 'over' ? 'Your balance would go below zero before payday.' : sim.worst === 'below' ? 'Bills are covered, but your savings plan dips below your cushion.' : goal.gap > 0 ? 'Bills are covered, but your goal needs an adjustment.' : 'Bills are covered and your goal is on track.';
  return (
    <>
      <div className={'weather-hero sky-' + tod}>
        <div className="weather-copy">
          <span className="weather-kicker">{night ? 'TONIGHT’S' : 'TODAY’S'} FINANCIAL FORECAST</span>
          <h1>{headline}</h1>
          <div className="sub">{longDate(today)}{nextPay ? ` · Next paycheck ${weekdayIso(nextPay.date)}` : ''} · Forecast through {prettyDate(lastDay.date)}</div>
        </div>
        <div className="hero-weather"><Sky state={sim.worst} night={night} /></div>
      </div>
      <Outlook sim={sim} h={h} />
      <div className="top-actions"><span className="pill teal"><Icon n="bank" s={13} />{sourceLabel}</span><span className="pill neutral" title="Items needing attention"><Icon n="bell" s={13} />{alerts.filter(a => a.tone !== 'good').length}</span></div>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Kpi label="Checking balance" value={<Num v={h.checking} />} sub="Everyday Checking" />
        <Kpi label="Lowest projected balance" value={<Num v={sim.low.balance} />} sub={`${prettyDate(sim.low.date)} · cushion ${money(h.cushion)}`} pill={<span className={'pill ' + tone}>{st}</span>} />
        <Kpi label="Contribution the plan supports" value={<><Num v={cap} />/mo</>} sub={`Planned ${money(h.goal.planned)} · ${cap < h.goal.planned ? `${money(h.goal.planned - cap)} less after the bill change` : 'unchanged'}`} pill={cap < h.goal.planned ? <span className="pill warn"><Icon n="down" s={11} />{money(h.goal.planned - cap)}</span> : <span className="pill good">OK</span>} />
        <Kpi label={h.goal.label} value={<Num v={goal.projected} />} sub={`Projected of ${money(h.goal.target)} by ${goal.targetLabel}`} pill={goal.gap ? <span className="pill bad">{money(goal.gap)} short</span> : <span className="pill good">On track</span>} />
      </div>
      <div className="grid g32">
        <div className="grid" style={{ gap: 18 }}>
          <div className="card">
            <div className="hd"><div><h2>Projected checking balance</h2><div className="fine">{preview ? `Dashed line: ${preview.title.toLowerCase()}. Solid line: your current plan.` : `Next ${h.windowDays} days · scheduled bills, expected income, everyday spending and your ${money(sc.contribution)} contribution`}</div></div>
              <div className="legend"><span><i style={{ background: 'var(--rain)' }}></i>Balance</span><span><i style={{ background: 'var(--mint)', borderRadius: '50%' }}></i>Paycheck</span><span><i style={{ background: 'var(--surface)', border: '2px solid var(--rain)', borderRadius: '50%', width: 8, height: 8 }}></i>Bill ≥ $100</span><span><i style={{ background: 'var(--warn)', height: 2, width: 14 }}></i>Cushion</span></div></div>
            <AreaChart h={h} sim={sim} preview={previewSim} id="dash" height={210} compact />
          </div>
          <div className="grid g2">
            <div className="card">
              <div className="hd"><h2>What changed</h2>
                {changedBills.length ? <span className="pill warn"><Icon n="up" s={11} />{changedBills.length} accepted</span>
                  : waiting.length ? <span className="pill accent">{waiting.length} waiting</span>
                  : <span className="pill good"><Icon n="check" s={11} />No increases</span>}</div>
              {changedBills.map(bill => (
                <div className="row" style={{ alignItems: 'flex-start' }} key={bill.id}>
                  <div className="cat"><i className="rec"><Icon n="repeat" s={14} /></i></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{bill.label}</div>
                    <div className="fine">{money(bill.amount)} → <b className="num" style={{ color: 'var(--ink)' }}>{money(plan.whatIf?.[bill.id] ?? bill.change.to)}</b> per month · takes effect {prettyIso(bill.change.effective)}</div>
                    <div className="fine">{plan.whatIf?.[bill.id] != null ? `What-if scenario · the notice says ${money(bill.change.to)}` : `${bill.change.why}, per the notice`}</div>
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
              {waiting.map(n => (
                <div className="row" style={{ alignItems: 'flex-start' }} key={n.id}>
                  <div className="cat"><i className="rev"><Icon n="mail" s={14} /></i></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>A notice is waiting to be reviewed</div>
                    <div className="fine">{n.originLabel}</div>
                    <div className="fine">Not counted in your forecast until you accept it.</div>
                  </div>
                  <button className="btn sm" onClick={() => onReviewNotice(n)}>Review it</button>
                </div>
              ))}
              {!changedBills.length && !unexplainedBills.length && !waiting.length && <div className="fine">Every commitment posted the amount we expected, and nothing is waiting to be reviewed.</div>}
              <div className="row wrap" style={{ gap: 8 }}>
                {changedBills.map(b => <button key={b.id} className="btn sm" onClick={() => open('bill', b.id)}>See what changed{changedBills.length > 1 ? `: ${b.label.toLowerCase()}` : ''}</button>)}
                <button className="btn ghost sm" onClick={() => open('compare')}>Compare options</button>
                <button className="btn ghost sm" onClick={() => open('notice')}><Icon n="mail" s={14} />Import a notice</button>
                {unexplainedBills.length > 0 && <button className="btn ghost sm" onClick={() => open('page:recurring')}>Decide on {unexplainedBills.length === 1 ? unexplainedBills[0].label.toLowerCase() : 'these charges'}</button>}
              </div>
            </div>
            <div className="card">
              <div className="hd"><h2>{h.goal.label}</h2><span className={'pill ' + (goal.gap ? 'bad' : 'good')}>{goal.gap ? `${money(goal.gap)} short` : 'On track'}</span></div>
              <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                <GoalRing saved={h.goal.saved} target={h.goal.target} projected={goal.projected} />
                <div className="grid" style={{ gap: 6 }}>
                  <span className="row" style={{ gap: 8 }}><i className="dot" style={{ background: 'var(--rain)' }} /><span className="fine">Saved <b className="num">{money(h.goal.saved)}</b></span></span>
                  <span className="row" style={{ gap: 8 }}><i className="dot" style={{ background: 'var(--sky)' }} /><span className="fine">Plan reaches <b className="num">{money(goal.projected)}</b></span></span>
                  <span className="row" style={{ gap: 8 }}><i className="dot" style={{ background: 'var(--line)' }} /><span className="fine">Target <b className="num">{money(h.goal.target)}</b> by {goal.targetLabel}</span></span>
                </div>
              </div>
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
          {found && <div className="card" style={{ background: 'var(--insight-bg)' }}><div className="hd"><h2>Here is what we found</h2><button className="link" onClick={() => setFound(false)}>Dismiss</button></div>
            <div className="row wrap" style={{ gap: 6 }}><span className="pill good"><Icon n="check" s={11} />Paycheck about every {cadenceWords(h.income)}</span><span className="pill good"><Icon n="check" s={11} />{h.recurring.length} recurring commitments</span>{reviewCount > 0 && <span className="pill warn">{reviewCount} charge{reviewCount === 1 ? ' needs' : 's need'} review</span>}</div>
            <div><button className="btn ghost sm" onClick={() => open('page:transactions')}>Review my plan</button></div></div>}
          <Alerts alerts={alerts} open={open} />
          <Reminders reminders={reminders} leadDays={leadDays} setLeadDays={setLeadDays} onPaid={onPaid} />
          <IncomeList h={h} plan={plan} change={change} compact />
        </div>
      </div>
    </>
  );
}
