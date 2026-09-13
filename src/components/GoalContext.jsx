import { Icon, prettyIso } from './ui.jsx';
import { budgetMoney as money } from './BudgetImpact.jsx';

const sections = [
  ['transactions', 'Transactions', 'Past income and spending help form estimates. Your category edits organize this list but do not change the forecast yet.'],
  ['recurring', 'Recurring', 'Upcoming bills and the future prices you confirm are included in the plan. An unusual charge needs review before it becomes a new estimate.'],
  ['purchases', 'Purchases', 'A planned cost changes available checking and what saving can fit. Confirming a matching posted payment removes the planned duplicate.'],
  ['forecast', 'Forecast', 'The day-by-day forecast combines paydays, bills, living costs and planned savings. The goal check looks further ahead, through your deadline.'],
  ['alerts', 'Alerts', 'When checking or your goal needs attention, review the cause and compare changes. Dismissing an alert does not add money or repair a shortfall.'],
  ['cashflow', 'Spending & Savings', 'Compare recorded spending with category budgets, then preview changes before planning extra savings.'],
];

/** A small, shared goal anchor; details stay out of the dashboard's main reading path. */
export default function GoalContext({ page, h, goal, open }) {
  if (page === 'recurring' || page === 'forecast' || page === 'purchases' || page === 'cashflow' || page === 'alerts') return null;
  const section = sections.find(([id]) => id === page);
  if (!section) return null;
  const status = !goal.fits ? 'Savings plan needs review' : goal.gap > 0 ? `${money(goal.gap)} short of goal` : 'On track in this estimate';
  return <section className="goal-context" aria-label="Connected savings goal">
    <div className="goal-context-heading">
      <Icon n="target" s={19} />
      <div><b>{h.goal.label}</b><p>{goal.shared ? `${goal.goals.length} goals · ${money(h.goal.target)} combined target` : `${money(h.goal.target)} by ${prettyIso(goal.targetDate)}`} · planned {money(goal.contribution)}/month</p></div>
      <span className={'pill ' + (!goal.fits || goal.gap > 0 ? 'warn' : 'good')}>{status}</span>
      <button className="btn ghost sm" onClick={() => open('page:goals')}>{goal.shared ? 'View goals' : 'View goal'}</button>
    </div>
    <p className="goal-context-note">{section[2]}</p>
  </section>;
}

export function PlanConnections({ open }) {
  return <details className="plan-connections">
    <summary>How your goals connect to your money</summary>
    <p>Give each goal a target, deadline and monthly amount. We check the combined savings against expected bills and living costs. The checking buffer covers timing gaps; an emergency fund is a separate savings goal.</p>
    <ol>{sections.map(([id, label, description]) => <li key={id}>
      <button className="link" onClick={() => open(`page:${id}`)}>{label}<Icon n="arrow" s={14} /></button>
      <p>{description}</p>
    </li>)}</ol>
  </details>;
}
