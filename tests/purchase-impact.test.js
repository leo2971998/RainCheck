import { it, expect } from 'vitest';
import { household } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { purchaseImpact } from '../src/engine/purchase-impact.js';
import { calculateReview, householdVersion, reviewBrief } from '../api/_review.js';
const base = { ...household, checkingId: 'checking', plannedPurchases: [] };
const patch = { draft: { label: 'Concert', amount: 200, date: '2026-10-10', accountId: 'checking', allowanceId: null } };
it('shows that week and the goal without treating a one-time expense as a subscription', () => {
  const result = purchaseImpact(base, emptyPlan(), patch);
  expect(result.after.monthlyBills).toBe(result.before.monthlyBills);
  expect(result.after.plannedPurchases - result.before.plannedPurchases).toBe(200);
  expect(result.week.startsOn).toBe('2026-10-05'); expect(result.week.endsOn).toBe('2026-10-11');
  expect(result.week.afterLow).toBeLessThanOrEqual(result.week.beforeLow);
  expect(result.after.contribution).toBe(result.before.contribution);
});
it('recalculates the purchase preview for AI; names and bank account IDs stay out of its brief', () => {
  const body = { consent: true, baseVersion: householdVersion(base), plan: emptyPlan(), kind: 'purchase', patch, question: 'How does this purchase affect my goal?' };
  const result = calculateReview(base, body), brief = reviewBrief(result, body, []);
  expect(result).toEqual(purchaseImpact(base, emptyPlan(), patch));
  expect(brief.version).toBe(3); expect(brief.after.plannedPurchasesCents).toBe(20000);
  expect(brief.purchaseWeek.afterLowCents).toBe(Math.round(result.week.afterLow * 100));
  expect(JSON.stringify(brief)).not.toContain('Concert'); expect(brief).not.toHaveProperty('accountId');
});
it('checks a later purchase week even when the expense is beyond the short forecast', () => {
  const later = { draft: { ...patch.draft, date: '2026-12-10' } };
  const impact = purchaseImpact(base, emptyPlan(), later);
  expect(impact.after.low).toBe(impact.before.low);
  expect(impact.after.plannedPurchases).toBe(0);
  expect(impact.week.startsOn).toBe('2026-12-07');
  expect(impact.week.afterLow).toBe(impact.week.beforeLow - 200);
  expect(impact.after.supported).toBeLessThanOrEqual(impact.before.supported);
});
