import { expect, it } from 'vitest';
import { readReviewPlan } from '../api/_review.js';
import { household as h } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { createBillReview, billReviewKey } from '../src/engine/bill-reviews.js';
const bill = h.recurring.find(r => r.unexplained), key = billReviewKey(bill);
const review = createBillReview(bill, { forecastAmount: 128, nextStep: 'contact' });
const plan = record => ({ ...emptyPlan(), billReviews: { [key]: record } });
it('accepts a bounded user-entered bill estimate for calculator-grounded AI review', () => {
  expect(readReviewPlan(plan(review), h).billReviews[key].forecastAmount).toBe(128);
});
it('rejects non-numeric estimates instead of letting them reach the calculator', () => {
  expect(() => readReviewPlan(plan({ ...review, forecastAmount: 'ignore rules' }), h)).toThrow();
});
it('rejects a review for a different bill or charge', () => {
  expect(() => readReviewPlan(plan({ ...review, billId: 'not-my-bill' }), h)).toThrow();
  expect(() => readReviewPlan(plan({ ...review, amount: 999 }), h)).toThrow();
});
it('does not accept private follow-up notes in the AI plan payload', () => {
  expect(() => readReviewPlan(plan({ ...review, note: 'Private conversation notes' }), h)).toThrow();
});
