export const budgetDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const budgetMoney = n => Number.isFinite(n)
  ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })
  : 'Not available';

export default function BudgetImpact({ impact }) {
  const { before: a, after: b, cushion } = impact;
  const safe = b.low >= cushion && b.fits;
  const status = budgetStatus(b, cushion);
  const rows = [
    ['Monthly bills', a.monthlyBills, b.monthlyBills],
    ...((a.plannedPurchases || b.plannedPurchases) ? [[`Planned purchases · ${impact.windowDays} days`, a.plannedPurchases, b.plannedPurchases]] : []),
    ['Planned monthly saving', a.contribution, b.contribution],
    [`Lowest checking · next ${impact.windowDays} days`, a.low, b.low],
    ['Goal savings if contributions are made', a.projected, b.projected],
  ];
  return <section className="budget-impact" aria-label="Budget preview" aria-live="polite">
    <span className="pill teal">Preview · not applied</span>
    <h3>{status.label}</h3>
    <p>{b.shared ? `${b.goals.length} goals · ${budgetMoney(b.target)} combined target. Each keeps its own deadline.` : `${b.goalLabel}: ${budgetMoney(b.target)} by ${budgetDate(b.targetDate)}.`}
      {b.gap > 0 && ` The projected shortfall is ${budgetMoney(b.gap)}.`}
      {!safe && ` Keep an eye on your ${budgetMoney(cushion)} checking cushion.`}</p>
    <div className="budget-comparison">
      <div className="budget-comparison-head"><span>What changes</span><b>Now</b><b>Preview</b></div>
      {rows.map(([label, before, after]) => <div key={label}><span>{label}</span><b>{budgetMoney(before)}</b><b>{budgetMoney(after)}</b></div>)}
    </div>
    {a.targetDate !== b.targetDate && <p className="fine">Different deadlines: Now {budgetDate(a.targetDate)}; preview {budgetDate(b.targetDate)}. The totals cover different periods.</p>}
    {b.shared && <details><summary>Impact on each goal</summary><ul className="budget-list">{b.goals.map(g => <li key={g.id}>
      <div><b>{g.label} · {budgetMoney(g.contribution)}/month</b><span className="fine">{budgetMoney(g.saved)} allocated · target {budgetMoney(g.target)} by {budgetDate(g.targetDate)}<br />Projected {budgetMoney(g.projected)}{g.gap ? ` · ${budgetMoney(g.gap)} short` : ' · reaches target'}</span></div>
    </li>)}</ul></details>}
    <p className="fine">{b.shared ? `Of this planned savings mix, ${budgetMoney(b.supported)}/month fits the estimated cash flow. Your chosen amounts stay unchanged.` : <>With this change, the calculator supports up to {budgetMoney(b.supported)}/month toward the goal
      {b.checkedThrough ? ` through ${budgetDate(b.checkedThrough)}` : ''}. This prototype tests contributions up to $600/month.
      </>}
      {' '}Expected income and everyday spending are estimates, not guarantees.</p>
  </section>;
}
import { budgetStatus } from '../engine/review-status.js';
