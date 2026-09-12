<<<<<<< Updated upstream
import { Icon, Kpi, STATE, money, prettyDate, longDate } from '../components/ui.jsx';
import { AreaChart, GoalChart, CashBars } from '../components/charts.jsx';
import IncomeList from '../components/IncomeList.jsx';
import Alerts from '../components/Alerts.jsx';

export default function Dashboard({ h, source, sc, setSc, sim, cap, goal, alerts, open, applied, found, setFound }) {
  const [st, tone] = STATE[sim.worst];
  const internet = h.recurring.find(r => r.change);
  const today = new Date(h.today + 'T12:00:00');
  const sourceLabel = { sample: 'Sample data', nessie: 'Nessie sandbox', snapshot: 'Saved sandbox snapshot' }[source];
  const headline = sim.worst === 'over' ? 'Storm warning: your balance may dip below zero.' : sim.worst === 'below' ? 'A little rain ahead, but your bills are covered.' : goal.gap > 0 ? 'Clear skies for bills. Your goal needs a small course correction.' : 'Your money forecast is looking bright.';
  return (
    <>
      <div className="weather-hero"><div className="weather-copy"><span className="weather-kicker">TODAY’S FINANCIAL FORECAST</span><h1>{headline}</h1><div className="sub">{longDate(today)} · Next paycheck Friday, Oct 2 · Forecast through Oct 31</div></div><div className="hero-weather" aria-hidden="true"><span className="sun">☀</span><span className="cloud">☁</span><span className="drops">···</span></div></div>
      <div className="top-actions"><span className="pill teal"><Icon n="bank" s={13} />{sourceLabel}</span><button className="btn ghost sm" disabled aria-label="Attention count"><Icon n="bell" s={15} />{alerts.length}</button></div>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Kpi label="Current balance" value={money(h.checking)} sub="Everyday Checking" />
        <Kpi label="Rainy-day low" value={money(sim.low.balance)} sub={`${prettyDate(sim.low.date)} · cushion ${money(h.cushion)}`} pill={<span className={'pill ' + tone}>{st}</span>} />
        <Kpi label="Safe to save" value={`${money(cap)}/mo`} sub={`Planned ${money(h.goal.planned)} · ${cap < h.goal.planned ? `${money(h.goal.planned - cap)} less after the bill change` : 'unchanged'}`} pill={cap < h.goal.planned ? <span className="pill warn"><Icon n="down" s={11} />{money(h.goal.planned - cap)}</span> : <span className="pill good">OK</span>} />
        <Kpi label={h.goal.label} value={money(goal.projected)} sub={`Projected of ${money(h.goal.target)} by ${goal.targetLabel}`} pill={goal.gap ? <span className="pill bad">{money(goal.gap)} short</span> : <span className="pill good">On track</span>} />
      </div>
      <div className="grid g32">
        <div className="grid" style={{ gap: 18 }}>
          <div className="card">
            <div className="hd"><div><h2>Projected checking balance</h2><div className="fine">Next 34 days · scheduled bills, expected income, everyday spending and your {money(sc.contribution)} contribution</div></div>
              <div className="legend"><span><i style={{ background: 'var(--rain)' }}></i>Balance</span><span><i style={{ background: 'var(--mint)', borderRadius: '50%' }}></i>Paycheck</span><span><i style={{ background: 'var(--surface)', border: '2px solid var(--rain)', borderRadius: '50%', width: 8, height: 8 }}></i>Bill ≥ $100</span><span><i style={{ background: 'var(--sun-deep)', height: 2, width: 14 }}></i>Cushion</span></div></div>
            <AreaChart h={h} sim={sim} id="dash" />
          </div>
          <div className="grid g2">
            <div className="card">
              <div className="hd"><h2>What changed</h2><span className="pill warn"><Icon n="up" s={11} />1 increase detected</span></div>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="cat"><i className="rec"><Icon n="repeat" s={14} /></i></div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{internet.label}</div><div className="fine">{money(internet.amount)} → <b className="num" style={{ color: 'var(--ink)' }}>{money(internet.amount + sc.increase)}</b> per month · takes effect Oct 1</div><div className="fine">{internet.change.why}, per the notice{sc.increase !== 25 ? ' · amount edited for the demo' : ''}</div></div>
              </div>
              <div className="row wrap" style={{ gap: 8 }}><button className="btn sm" onClick={() => open('bill')}>See what changed</button><button className="btn ghost sm" onClick={() => open('compare')}>Compare options</button></div>
            </div>
            <div className="card">
              <div className="hd"><h2>{h.goal.label}</h2><span className={'pill ' + (goal.gap ? 'bad' : 'good')}>{goal.gap ? `${money(goal.gap)} short` : 'On track'}</span></div>
              <GoalChart h={h} goal={goal} cap={applied ? sc.contribution : cap} />
              <div className="row between fine"><span>Saved <b className="num">{money(h.goal.saved)}</b> · projected <b className="num">{money(goal.projected)}</b></span><span>Updated plan <b className="num">{money(applied ? sc.contribution : cap)}/mo</b></span></div>
              {applied && <span className="pill good"><Icon n="check" s={11} />{applied.label}</span>}
            </div>
          </div>
          <div className="card">
            <div className="hd"><h2>Cash flow</h2><span className="fine">October is projected from the forecast</span></div>
            <CashBars h={h} sim={sim} />
          </div>
        </div>
        <div className="grid" style={{ gap: 18 }}>
          {found && <div className="card" style={{ background: 'var(--insight-bg)' }}><div className="hd"><h2>Here is what we found</h2><button className="link" onClick={() => setFound(false)}>Dismiss</button></div>
            <div className="row wrap" style={{ gap: 6 }}><span className="pill good"><Icon n="check" s={11} />Paycheck about every two weeks</span><span className="pill good"><Icon n="check" s={11} />7 recurring commitments</span><span className="pill warn">2 transactions need review</span></div>
            <div><button className="btn ghost sm" onClick={() => open('page:transactions')}>Review my plan</button></div></div>}
          <Alerts alerts={alerts} open={open} />
          <IncomeList h={h} sc={sc} setSc={setSc} compact />
=======
import { useEffect, useState } from 'react';
import { Icon, Kpi, Num, STATE, money, prettyDate, longDate, prettyIso, weekdayIso } from '../components/ui.jsx';
import { AreaChart } from '../components/charts.jsx';
import { Sky, Outlook, timeOfDay } from '../components/Weather.jsx';
import { GoalRing } from '../components/GoalRing.jsx';

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
  // Appearance mode never decides whether it is day or night. Start with a stable server value,
  // then read the visitor's local clock and refresh it so the banner can cross a boundary while open.
  const [tod, setTod] = useState('day');
  useEffect(() => {
    const update = () => setTod(timeOfDay());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Alerts alone decide the icon: clear when nothing needs attention, partly cloudy for a warning,
  // and stormy for a severe alert. Positive confirmations do not cloud the forecast.
  const activeAlerts = alerts.filter(a => a.tone !== 'good');
  const weatherState = activeAlerts.some(a => a.tone === 'bad') ? 'over' : activeAlerts.length ? 'tight' : 'ok';
  const attention = activeAlerts.length + reminders.length + waiting.length;
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
        <div className="hero-weather"><Sky state={weatherState} night={night} /></div>
      </div>
      <Outlook sim={sim} h={h} />
      <div className="top-actions"><span className="pill teal"><Icon n="bank" s={13} />{sourceLabel}</span></div>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Kpi label="Checking balance" value={<Num v={h.checking} />} sub="Everyday Checking" />
        <Kpi label="Lowest projected balance" value={<Num v={sim.low.balance} />} sub={`${prettyDate(sim.low.date)} · cushion ${money(h.cushion)}`} pill={<span className={'pill ' + tone}>{st}</span>} />
        <Kpi label="Contribution the plan supports" value={<><Num v={cap} />/mo</>} sub={`Planned ${money(h.goal.planned)} · ${cap < h.goal.planned ? `${money(h.goal.planned - cap)} less after the bill change` : 'unchanged'}`} pill={cap < h.goal.planned ? <span className="pill warn"><Icon n="down" s={11} />{money(h.goal.planned - cap)}</span> : <span className="pill good">OK</span>} />
        <Kpi label={h.goal.label} value={<Num v={goal.projected} />} sub={`Projected of ${money(h.goal.target)} by ${goal.targetLabel}`} pill={goal.gap ? <span className="pill bad">{money(goal.gap)} short</span> : <span className="pill good">On track</span>} />
      </div>
      {/* A glance at what lives on the other pages, and a way there. Each line is the same figure
          that page shows, so a peek never promises something the page then contradicts. */}
      <div className="peeks" aria-label="More on other pages">
        <button className="peek" onClick={() => open('page:alerts')}>
          <i className="pk-ic"><Icon n="bell" s={15} /></i>
          <span className="pk-l">Alerts</span>
          <b className="pk-v">{attention ? `${attention} need${attention === 1 ? 's' : ''} your attention` : 'All clear'}</b>
          <i className="pk-go"><Icon n="arrow" s={14} /></i>
        </button>
        <button className="peek" onClick={() => open('page:alerts')}>
          <i className="pk-ic"><Icon n="repeat" s={15} /></i>
          <span className="pk-l">Coming up</span>
          <b className="pk-v">{reminders[0] ? `${reminders[0].label} ${reminders[0].when} · ${money(reminders[0].amount)}` : 'No bills due soon'}</b>
          <i className="pk-go"><Icon n="arrow" s={14} /></i>
        </button>
        <button className="peek" onClick={() => open('page:cashflow')}>
          <i className="pk-ic"><Icon n="bars" s={15} /></i>
          <span className="pk-l">Cash flow</span>
          <b className="pk-v">{lastDay.date.toLocaleDateString('en-US', { month: 'long' })} · {money(sim.cash.income - sim.cash.bills - sim.cash.everyday - sim.cash.savings)} left over</b>
          <i className="pk-go"><Icon n="arrow" s={14} /></i>
        </button>
        <button className="peek" onClick={() => open('page:forecast')}>
          <i className="pk-ic"><Icon n="trend" s={15} /></i>
          <span className="pk-l">Expected income</span>
          <b className="pk-v">{nextPay ? `${weekdayIso(nextPay.date)} · +${money(nextPay.amount)}` : 'No paycheck found'}</b>
          <i className="pk-go"><Icon n="arrow" s={14} /></i>
        </button>
      </div>
      <div className="grid" style={{ gap: 18 }}>
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
>>>>>>> Stashed changes
        </div>
      </div>
    </>
  );
}
