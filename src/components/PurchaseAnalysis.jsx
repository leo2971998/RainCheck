import { budgetDate as date, budgetMoney as money } from './BudgetImpact.jsx';

export default function PurchaseAnalysis({ impact, amount, onTryAmount, onTryDate }) {
  const f = impact.funding, goal = impact.after;
  const goalsFit = f.fits && goal.fits && !goal.gap;
  return <section className="purchase-analysis" aria-label="Purchase funding check">
    <h3>{f.fits ? 'This purchase fits the checking budget' : `${money(f.neededToKeepCushion)} more room needed by ${date(f.lowDate)}`}</h3>
    <p>Checking could reach <b>{money(f.low)}</b> on {date(f.lowDate)}. Your buffer is {money(impact.cushion)}.</p>
    {!f.fits && <>
      {f.neededToAvoidNegative > 0 && <p><b>{money(f.neededToAvoidNegative)}</b> is needed just to avoid going below zero.</p>}
      {!f.baselineFits && <p>The budget needs attention even without this purchase.</p>}
      {f.withoutSavingLow < 0 && <p>Even pausing goal contributions leaves a cash shortfall. Saving more after that date cannot cover an earlier payment.</p>}
      <div className="row wrap budget-actions">
        {f.maxAmount > 0 && f.maxAmount < amount && <button className="btn ghost" onClick={() => onTryAmount(f.maxAmount)}>Try a {money(f.maxAmount)} purchase</button>}
        {f.laterDate && <button className="btn ghost" onClick={() => onTryDate(f.laterDate)}>Try {date(f.laterDate)}</button>}
      </div>
    </>}
    <div className="purchase-goal-verdict"><b>{goalsFit ? 'Your savings plan still fits' : 'Your savings plan needs an adjustment'}</b>
      <p>{money(goal.contribution)}/month planned · {money(goal.saved)} saved toward {money(goal.target)}{goal.shared ? ' across your goals' : ` by ${date(goal.targetDate)}`}.</p>
      {!goalsFit && <p>The target is not a funded outcome in this preview. Adjust the purchase, spending, or goal plan before relying on it.</p>}</div>
    <p className="fine">Bills and goal contributions are unchanged. Checked through {date(f.checkedThrough)}.</p>
  </section>;
}
