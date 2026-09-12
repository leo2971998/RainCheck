import { expect, it } from 'vitest';
import { household as base } from '../data/household.sample.js';
import { emptyPlan, applyPatch, revert } from '../src/engine/plan.js';
import { amountFor, simulate, capacity } from '../src/engine/forecast.js';
import { buildAlerts } from '../src/engine/alerts.js';
import { billReviewKey, needsBillReview, createBillReview, migrateBillReviews } from '../src/engine/bill-reviews.js';

const bill = base.recurring.find(r => r.unexplained);
const sc = { ...emptyPlan(), contribution: 0 };
const save = (forecastAmount = bill.amount) => {
  const record = createBillReview(bill, { forecastAmount, nextStep: 'contact' }, '2026-09-28T12:00:00Z');
  return applyPatch(sc, { billReviews: { [billReviewKey(bill)]: record } }, 'Electric charge reviewed');
};

it('keeps a separate bill anomaly open when a commitment suggestion is dismissed', () => {
  expect(needsBillReview(bill, { ...sc, dismissed: { 'possible-gym': true } })).toBe(true);
});
it('clears a reviewed charge without changing the forecast or asserting a reason', () => {
  const { plan } = save();
  expect(needsBillReview(bill, plan)).toBe(false);
  expect(simulate(base, plan).low.balance).toBe(simulate(base, sc).low.balance);
  const alerts = buildAlerts(base, plan, simulate(base, plan), capacity(base, plan));
  expect(alerts.some(a => a.id.startsWith('unexplained:'))).toBe(false);
  expect(plan.billReviews[billReviewKey(bill)].nextStep).toBe('contact');
});
it('uses a chosen future estimate but does not silently adopt the next unusual amount', () => {
  const { plan } = save(128);
  expect(amountFor(bill, '2026-10-10', plan)).toBe(128);
  const later = { ...bill, lastPosted: 160, lastPostedDate: '2026-10-10', lastPostedId: 'later-charge' };
  expect(needsBillReview(later, plan)).toBe(true);
  expect(amountFor(later, '2026-11-10', plan)).toBe(128);
});
it('keys reviews to individual charges and preserves earlier review records', () => {
  const { plan } = save();
  const later = { ...bill, lastPostedDate: '2026-10-10', lastPostedId: 'later-charge' };
  const second = createBillReview(later, { forecastAmount: 128, nextStep: 'watch' });
  const result = applyPatch(plan, { billReviews: { [billReviewKey(later)]: second } });
  expect(Object.keys(result.plan.billReviews)).toHaveLength(2);
  expect(revert(result.plan, result.entry).billReviews).toEqual(plan.billReviews);
});
it('carries earlier one-time decisions into a charge-scoped review once', () => {
  const old = { ...sc, treatAsNewPrice: { [bill.id]: false } };
  const migrated = migrateBillReviews(base, old);
  expect(needsBillReview(bill, migrated)).toBe(false);
  expect(migrated.treatAsNewPrice).toEqual({});
  expect(migrateBillReviews(base, migrated)).toBe(migrated);
  expect(needsBillReview({ ...bill, lastPostedDate: '2026-10-10' }, migrated)).toBe(true);
});
it('does not count a cancelled bill as a pending review', () => {
  expect(needsBillReview(bill, { ...sc, cancelled: { [bill.id]: true } })).toBe(false);
});
it('rejects invalid estimate amounts and unsupported next steps', () => {
  expect(() => createBillReview(bill, { forecastAmount: -1, nextStep: 'contact' })).toThrow();
  expect(() => createBillReview(bill, { forecastAmount: 100, nextStep: 'company-admitted-fault' })).toThrow();
});
