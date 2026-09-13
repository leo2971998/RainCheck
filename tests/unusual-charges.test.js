import { expect, it } from 'vitest';
import { spendingShape, unusualCharges, unusualReason, answerChargePatch, chargeKey } from '../src/engine/unusual-charges.js';
import { emptyPlan, applyPatch, revert } from '../src/engine/plan.js';
import { readReviewPlan, calculateReview, householdVersion } from '../api/_review.js';
import { household } from '../data/household.sample.js';

const history = Array.from({ length: 30 }, (_, i) => ({ id: `purchase:usual-${i}`, k: 'ev',
  date: '2026-08-01', what: 'Usual shop', amt: -(50 + i) }));
const first = { id: 'purchase:first', date: '2026-09-08', d: 'Sep 8', k: 'ev', what: 'Appliance shop', amt: -742 };
const second = { ...first, id: 'purchase:second', date: '2026-09-09', what: 'Another shop', amt: -650 };
const transactions = [...history, first, second];

it('keeps unknown charges open and clears only charges the person recognises', () => {
  const unknown = applyPatch(emptyPlan(), answerChargePatch(first, 'unknown')).plan;
  expect(unusualCharges(transactions, unknown).map(chargeKey)).toContain(chargeKey(first));
  const mine = applyPatch(unknown, answerChargePatch(first, 'mine')).plan;
  expect(unusualCharges(transactions, mine).map(chargeKey)).not.toContain(chargeKey(first));
});

it('keeps answers for separate charges and can undo only the last answer', () => {
  const one = applyPatch(emptyPlan(), answerChargePatch(first, 'mine')).plan;
  const two = applyPatch(one, answerChargePatch(second, 'mine'));
  expect(unusualCharges(transactions, two.plan)).toHaveLength(0);
  const undone = revert(two.plan, two.entry);
  expect(undone.chargeAnswers).toEqual(one.chargeAnswers);
  expect(unusualCharges(transactions, undone).map(chargeKey)).toEqual([chargeKey(second)]);
});

it('does not break budget reviews after a charge answer or send the answer as financial evidence', () => {
  const plan = applyPatch(emptyPlan(), answerChargePatch(first, 'unknown')).plan;
  const parsed = readReviewPlan(plan, household);
  expect(parsed.chargeAnswers).toEqual({});
  const body = { consent: true, baseVersion: householdVersion(household), plan, patch: {}, kind: 'plan',
    question: 'Review my spending plan.', focus: 'spending', optimize: true, protectedCategories: [] };
  expect(calculateReview(household, body)).toEqual(calculateReview(household, { ...body, plan: emptyPlan() }));
});

it('excludes recurring bills, transfers, refunds and thin histories', () => {
  const shape = spendingShape(transactions);
  for (const k of ['rec', 'tr', 'in']) expect(unusualReason({ ...first, k }, shape)).toBeNull();
  expect(unusualReason({ ...first, amt: 742 }, shape)).toBeNull();
  expect(unusualReason(first, spendingShape(history.slice(0, 10)))).toBeNull();
});

it('ignores small first-time purchases and lists pending charges newest first', () => {
  expect(unusualReason({ ...first, amt: -12 }, spendingShape(transactions))).toBeNull();
  expect(unusualCharges(transactions).map(chargeKey)).toEqual([chargeKey(second), chargeKey(first)]);
});
