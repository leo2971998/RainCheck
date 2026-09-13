import { applyPatch, householdFor, scenarioFor } from './plan.js';
import { simulate, round2 } from './forecast.js';
import { readSubscription, subscriptionPatch } from './budget.js';

export const RAIN_DEMO_ID = 'sub-local-rain-test';

/** A labeled budget-only cost, never fabricated weather or a bank write. */
export function rainDemoPatch(base, plan) {
  if (plan.subscriptions?.[RAIN_DEMO_ID]) throw new Error('A rain test is already active.');
  const h = householdFor(base, plan), sc = scenarioFor(h, plan), current = simulate(h, sc);
  if (h.cushion <= 0) throw new Error('Choose a checking target above $0 to test rain. At $0, a shortfall creates a storm.');
  if (['below', 'over'].includes(current.worst)) throw new Error('Your forecast already needs review. Use Review my plan first.');
  const gap = Math.max(0.01, Math.min(25, h.cushion / 2));
  const amount = round2(current.low.balance - h.cushion + gap);
  const item = readSubscription({ label: 'Local rain test (sample cost)', amount, startsOn: current.low.key }, h.today);
  const patch = subscriptionPatch(RAIN_DEMO_ID, item);
  const next = applyPatch(plan, patch).plan, nextH = householdFor(base, next);
  if (simulate(nextH, scenarioFor(nextH, next)).worst !== 'below')
    throw new Error('This test would create a different warning. Your plan has not changed.');
  return patch;
}
