import { expect, it } from 'vitest';
import { household as base } from '../data/household.sample.js';
import { emptyPlan, applyPatch, revert, scenarioFor } from '../src/engine/plan.js';
import { amountFor, simulate, capacity } from '../src/engine/forecast.js';
import { buildAlerts } from '../src/engine/alerts.js';
import { billReviewKey, needsBillReview, createBillReview, migrateBillReviews, billReviewPatch } from '../src/engine/bill-reviews.js';

const bill = base.recurring.find(r => r.unexplained);
it('opens the exact unusual charge and does not pretend to know why it changed', () => {
  const sc=scenarioFor(base,emptyPlan());
  const alert=buildAlerts(base,sc,simulate(base,sc),capacity(base,sc)).find(a=>a.id===`unexplained:${bill.id}`);
  expect(alert.actions[0]).toMatchObject({target:'anomaly',billId:bill.id});
  expect(alert).toMatchObject({ amount: bill.lastPosted, metricLabel: 'posted charge' });
  expect(alert.body).not.toContain('whether it was a one-time');
  const lower={...base,recurring:base.recurring.map(r=>r.id===bill.id?{...r,lastPosted:80}:r)};
  expect(buildAlerts(lower,sc,simulate(lower,sc),capacity(lower,sc)).find(a=>a.id===alert.id).title).toContain('lower');
});
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
  expect(needsBillReview({ ...later, lastPosted:128 }, plan)).toBe(false);
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
  expect(needsBillReview({ ...bill, lastPostedDate: '2026-10-10', lastPostedId: 'later-charge' }, migrated)).toBe(true);
});
it('does not count a cancelled bill as a pending review', () => {
  expect(needsBillReview(bill, { ...sc, cancelled: { [bill.id]: true } })).toBe(false);
});
it('rejects invalid estimate amounts and unsupported next steps', () => {
  expect(() => createBillReview(bill, { forecastAmount: -1, nextStep: 'contact' })).toThrow();
  expect(() => createBillReview(bill, { forecastAmount: 100, nextStep: 'company-admitted-fault' })).toThrow();
});
it('applies an explicitly chosen estimate even when a notice also exists for that bill', () => {
  const withNotice={...bill,change:{to:140,effective:'2026-10-01'}};
  const record=createBillReview(bill,{forecastAmount:125,nextStep:'watch'});
  const patch=billReviewPatch(withNotice,bill,record);
  const {plan}=applyPatch(sc,patch);
  expect(amountFor(withNotice,'2026-10-10',plan)).toBe(125);
  const earlier={...bill,lastPostedDate:'2026-08-06',lastPostedId:'earlier-charge'};
  const old=createBillReview(earlier,{forecastAmount:100,nextStep:'done'});
  expect(billReviewPatch(withNotice,earlier,old).whatIf).toBeUndefined();
});
