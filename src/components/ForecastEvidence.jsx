import { prettyDate, prettyIso } from './ui.jsx';
import { budgetMoney as money } from './BudgetImpact.jsx';
import { checkingBreakdown } from '../engine/forecast-explanation.js';

export function ForecastDate({ h, sim }) {
  const today = new Date().toLocaleDateString('en-CA');
  return <div className="forecast-dateline">
    <b>Forecast starts {new Date(h.today + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</b>
    <span>{h.today !== today ? 'Sample timeline, not today’s account balance.' : 'Starting from this account snapshot.'} Projected through {prettyDate(sim.days.at(-1).date)}.</span>
  </div>;
}

export function ForecastReason({ h, sim, expanded = false }) {
  const rows = checkingBreakdown(h, sim);
  const nextPay = sim.days.find(d => d.key > sim.low.key && d.events.some(e => e.pay));
  const bills = sim.days.filter(d => d.key <= sim.low.key)
    .flatMap(d => d.events.filter(e => e.bill).map(e => ({ ...e, date: d.date })));
  return <details className="forecast-reason" open={expanded || undefined}>
    <summary>Why could checking reach {money(sim.low.balance)} on {prettyDate(sim.low.date)}?</summary>
    <div className="forecast-reason-body">
      <p>Start with {money(h.checking)} on {prettyIso(h.today)}. Then follow the money in and out through {prettyDate(sim.low.date)}.</p>
      <dl className="forecast-breakdown">
        {rows.filter(r => r.amount !== 0 || r.label === 'Starting checking balance').map(r => <div key={r.label}><dt>{r.label}</dt><dd className="num">{r.label === 'Expected income' && r.amount > 0 ? '+' : ''}{money(r.amount)}</dd></div>)}
        <div className="breakdown-total"><dt>Checking left on {prettyDate(sim.low.date)}</dt><dd className="num">{money(sim.low.balance)}</dd></div>
      </dl>
      {nextPay && <p className="forecast-next-pay">The next expected paycheck after this point is {prettyDate(nextPay.date)}. It is not counted before that date.</p>}
      {!!bills.length && <p className="fine">Bills included: {bills.map(b => `${b.label} ${money(-b.amt)} (${prettyDate(b.date)})`).join(' · ')}.</p>}
      <p className="fine">You do not need a new purchase for checking to dip. Existing bills, estimated everyday spending and monthly savings all reduce it. These are projections, not payments we have made.</p>
    </div>
  </details>;
}
