import { withPurchase } from './purchases.js';
import { budgetImpact } from './budget.js';
import { householdFor, scenarioFor } from './plan.js';
import { simulate, projectIncome, scheduleUntil } from './forecast.js';

export function purchaseImpact(base, plan, patch) {
  if (!patch || Object.keys(patch).some(k => !['draft','id','remove'].includes(k)) || (patch.remove && !patch.id))
    throw new Error('Check the purchase preview.');
  const next = withPurchase(base, patch.draft, patch.id, patch.remove);
  const date = patch.remove ? base.plannedPurchases.find(p => p.id === patch.id).date : patch.draft.date;
  const effective = date < base.today ? base.today : date;
  const monday = new Date(effective + 'T12:00:00Z'); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6);
  const startsOn = [base.today, monday.toISOString().slice(0,10)].sort().at(-1), endsOn = sunday.toISOString().slice(0,10);
  const days = Math.round((sunday - new Date(base.today + 'T12:00:00Z')) / 864e5) + 1;
  const weekLow = b => {
    const h = householdFor(b, plan), sc = scenarioFor(h, plan);
    return Math.min(...simulate(h, { ...sc, income: projectIncome(h, endsOn), contributionDates: scheduleUntil(h, endsOn) }, { days }).days.filter(d => d.key >= startsOn).map(d => d.balance));
  };
  return { ...budgetImpact(base, plan, {}), after: budgetImpact(next, plan, {}).after,
    week: { startsOn, endsOn, beforeLow: weekLow(base), afterLow: weekLow(next) } };
}
