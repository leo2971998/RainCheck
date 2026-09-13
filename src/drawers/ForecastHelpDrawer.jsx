import { useState } from 'react';
import Drawer, { DrawerHeader } from '../components/Drawer.jsx';
import ReviewPanel from '../components/ReviewPanel.jsx';
import { prettyDate, prettyIso } from '../components/ui.jsx';
import { budgetMoney as money } from '../components/BudgetImpact.jsx';
import { round2 } from '../engine/forecast.js';

export function checkingBreakdown(h, sim) {
  const events = sim.days.slice(0, sim.days.findIndex(d => d.key === sim.low.key) + 1).flatMap(d => d.events);
  const rows = [{ label: 'Starting checking balance', amount: h.checking },
    ...[['pay', 'Expected income'], ['bill', 'Scheduled bills'], ['everyday', 'Everyday spending'],
      ['purchase', 'Planned purchases'], ['transfer', 'Planned savings']]
      .map(([flag, label]) => ({ label, amount: round2(events.filter(e => e[flag]).reduce((sum, e) => sum + e.amt, 0)) }))];
  const rounding = round2(sim.low.balance - rows.reduce((sum, row) => sum + row.amount, 0));
  if (rounding) rows.push({ label: 'Rounding', amount: rounding });
  return rows;
}

export default function ForecastHelpDrawer({ h, sc, sim, options = [], current, baseVersion, plan, open, onClose }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const rows = checkingBreakdown(h, sim);
  const short = Math.max(0, round2(h.cushion - sim.low.balance));
  const option = options.find(o => o.id === 'keep' && !o.disabled && !o.conditional &&
    o.outcome.meetsCushion && o.outcome.contribution < sc?.contribution);
  const patch = option ? { contribution: option.outcome.contribution } : {};
  return <Drawer label="Review my plan" onClose={onClose}>
    <DrawerHeader title="A plan for the rainy days" icon="target" onClose={onClose} />
    <div className="alert">
      <b>{sim.low.balance < 0 ? `Checking could go ${money(Math.abs(sim.low.balance))} below $0.`
        : `Your plan is ${money(short)} below your checking target.`}</b>
      <p>You want to keep {money(h.cushion)} available. The plan could leave {money(sim.low.balance)} on {prettyDate(sim.low.date)}.</p>
    </div>
    <section className="grid" style={{ gap: 10 }}>
      <h3>1. Check the numbers</h3>
      <p className="fine">From {prettyIso(h.today)} through {prettyDate(sim.low.date)}, your plan includes:</p>
      <dl className="forecast-breakdown">
        {rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd className="num">{row.amount > 0 && row.label === 'Expected income' ? '+' : ''}{money(row.amount)}</dd></div>)}
        <div className="breakdown-total"><dt>Checking left on {prettyDate(sim.low.date)}</dt><dd className="num">{money(sim.low.balance)}</dd></div>
      </dl>
      <p className="fine">These are estimates, not today's balance. Check any income, bill, or spending amount that looks wrong.</p>
      <div className="row wrap">
        <button className="btn ghost sm" onClick={() => open('page:forecast')}>Check income &amp; spending</button>
        <button className="btn ghost sm" onClick={() => open('page:recurring')}>Check bills</button>
      </div>
    </section>
    <section className="grid" style={{ gap: 10 }}>
      <h3>2. Preview a change</h3>
      <p>Compare saving less for now or reducing optional spending. See the effect on checking and your savings goal before deciding.</p>
      {option ? <div className="card rain-review-option">
        <span className="fine">Preview only · your target stays {money(h.cushion)}</span>
        <h3>One option: save less for now</h3>
        <dl className="forecast-breakdown">
          <div><dt>Save each month</dt><dd>{money(sc.contribution)} → {money(option.outcome.contribution)}</dd></div>
          <div><dt>Least left in checking</dt><dd>{money(sim.low.balance)} → {money(option.outcome.low)}</dd></div>
          <div><dt>Goal by {prettyIso(option.outcome.goalDate)}</dt><dd>{money(current.goalProjected)} → {money(option.outcome.goalProjected)}</dd></div>
        </dl>
        <p className="fine">{option.outcome.goalGap > 0
          ? `${money(option.outcome.goalGap)} short of your savings goal. Protecting checking now means saving more later, cutting another cost, or allowing more time.`
          : 'This forecast still reaches your savings goal if the planned contributions are made.'}</p>
        <p className="fine">Bills and everyday spending stay unchanged. This option protects your checking target for the next {h.windowDays} days; longer-term affordability is checked separately in the review.</p>
      </div> : options.length > 0 && <div className="alert">
        <b>Saving less alone does not close this gap.</b>
        <p>Review the income and costs above, then compare other adjustments. AI cannot make a shortfall disappear.</p>
      </div>}
      <button className="btn ghost" aria-expanded={reviewOpen} aria-controls="rain-ai-review" onClick={() => setReviewOpen(v => !v)}>
        {reviewOpen ? 'Hide AI review' : option ? 'Ask AI about this option' : 'Ask AI what to check'}
      </button>
      {reviewOpen && <div id="rain-ai-review"><ReviewPanel key={baseVersion + JSON.stringify(plan) + JSON.stringify(patch)}
        baseVersion={baseVersion} plan={plan} patch={patch} preview={!!option}
        initialQuestion={option
          ? 'Compare my rainy forecast with this lower-savings preview. Explain the checking and goal trade-off, and what I should check. Keep my checking target unchanged.'
          : 'My forecast is below my checking target, and saving less alone cannot resolve it. Explain what I should check next. Do not lower the target to hide the warning.'} /></div>}
      <button className="btn" onClick={() => open('compare')}>Compare adjustments</button>
      {rows.some(r => r.label === 'Planned purchases' && r.amount < 0) &&
        <button className="btn ghost" onClick={() => open('page:purchases')}>Review planned purchases</button>}
    </section>
    <section className="grid" style={{ gap: 10 }}>
      <h3>3. Choose what works for you</h3>
      <p>No money moves when you apply a budget plan. You still need to follow the spending or savings changes yourself.</p>
      <p className="fine">Rain clears when your saved forecast stays at or above your checking target. Clouds can remain when there's little room left. Closing an alert does not fix the forecast, and a planned cancellation is counted only after confirmation.</p>
    </section>
  </Drawer>;
}
