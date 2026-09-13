import { budgetDate as date, budgetMoney as money } from './BudgetImpact.jsx';

export default function PurchaseAnalysis({ impact, amount, onChoose }) {
  const f = impact.funding, goal = impact.after;
  const goalsFit = f.fits && goal.fits && !goal.gap;
  return <section className="purchase-analysis" aria-label="Purchase funding check">
    <h3>{f.fits ? 'This purchase fits the checking budget' : `${money(f.neededToKeepCushion)} more room needed by ${date(f.lowDate)}`}</h3>
    <p>Checking could reach <b>{money(f.low)}</b> on {date(f.lowDate)}. Your buffer is {money(impact.cushion)}.</p>
    {!f.fits && <>
      {f.neededToAvoidNegative > 0 && <p><b>{money(f.neededToAvoidNegative)}</b> is needed just to avoid going below zero.</p>}
      {!f.baselineFits && <p>The budget needs attention even without this purchase.</p>}
      {f.withoutSavingLow < 0 && <p>Even pausing goal contributions leaves a cash shortfall. Saving more after that date cannot cover an earlier payment.</p>}
      <div className="purchase-plan-options">
        {(f.options || []).map((option, i) => <article className="purchase-plan-option" key={option.kind}>
          <span className="review-eyebrow">{i === 0 ? 'Suggested plan' : 'Another option'}</span>
          <h3>{option.kind === 'later' ? `Keep ${money(option.amount)} · buy on ${date(option.date)}` : `Keep the date · spend up to ${money(option.amount)}`}</h3>
          <p>{option.kind === 'later' ? 'Give checking time to build up without reducing your savings contributions.'
            : `Reduce the purchase cost by ${money(amount - option.amount)} to keep ${date(option.date)}. This means changing what you buy, not recovering money already spent.`}</p>
          <dl><div><dt>Checking stays at least</dt><dd>{money(option.low)}</dd></div>
            <div><dt>Monthly goal savings</dt><dd>{money(goal.contribution)} · unchanged</dd></div></dl>
          <p className="fine">Checked through {date(option.checkedThrough)}.</p>
          <button className={`btn ${i ? 'ghost' : ''}`} onClick={() => onChoose(option)}>{option.kind === 'later' ? 'Review this date' : 'Review this amount'}</button>
        </article>)}
        {!f.options?.length && <p>No tested purchase option fits this budget yet. Change the cost or date, or review your spending and savings plan before adding it.</p>}
      </div>
    </>}
    <div className="purchase-goal-verdict"><b>{goalsFit ? 'Your savings plan still fits' : 'Your savings plan needs an adjustment'}</b>
      <p>{money(goal.contribution)}/month planned · {money(goal.saved)} saved toward {money(goal.target)}{goal.shared ? ' across your goals' : ` by ${date(goal.targetDate)}`}.</p>
      {!goalsFit && <p>The target is not a funded outcome in this preview. Adjust the purchase, spending, or goal plan before relying on it.</p>}</div>
    <p className="fine">Bills and goal contributions are unchanged. Checked through {date(f.checkedThrough)}.</p>
  </section>;
}
