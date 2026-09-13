import { applyPatch, householdFor, scenarioFor } from './plan.js';
import { simulate, round2 } from './forecast.js';
import { readSubscription, subscriptionPatch } from './budget.js';
import { weeklyBudget } from './weekly-budget.js';

export const RAIN_DEMO_ID = 'sub-local-rain-test';

/** A labeled budget-only cost, never fabricated weather or a bank write. */
export function rainDemoPatch(base, plan, period = 'forecast') {
  if (plan.subscriptions?.[RAIN_DEMO_ID]) throw new Error('A rain test is already active.');
  const h = householdFor(base, plan), sc = scenarioFor(h, plan);
  const weekly = period === 'week';
  const current = weekly ? weeklyBudget(h, sc) : simulate(h, sc);
  if (h.cushion <= 0) throw new Error('Choose a checking target above $0 to test rain. At $0, a shortfall creates a storm.');
  if (['below', 'over'].includes(weekly ? current.state : current.worst))
    throw new Error(weekly ? 'This week already needs review. Open Review this week first.' : 'Your forecast already needs review. Use Review my plan first.');
  const gap = Math.max(0.01, Math.min(25, h.cushion / 2));
  const amount = round2((weekly ? current.room - current.remainingBudget : current.low.balance - h.cushion) + gap);
  const item = readSubscription({ label: 'Local rain test (sample cost)', amount, startsOn: weekly ? h.today : current.low.key }, h.today);
  const patch = subscriptionPatch(RAIN_DEMO_ID, item);
  const next = applyPatch(plan, patch).plan, nextH = householdFor(base, next);
  const nextSc = scenarioFor(nextH, next);
  if ((weekly ? weeklyBudget(nextH, nextSc).state : simulate(nextH, nextSc).worst) !== 'below')
    throw new Error('This test would create a different warning. Your plan has not changed.');
  return patch;
}
