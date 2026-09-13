import { expect, it } from 'vitest';
import { purchaseImpact, purchaseEvidenceDocuments } from '../src/engine/purchase-impact.js';
import { reviewBrief } from '../api/_review.js';
import { emptyPlan } from '../src/engine/plan.js';
const base = { today: '2026-09-13', checking: 515, savings: 800, cushion: 200, windowDays: 34,
  checkingId: 'checking', spendingPeriod: 'calendar-month', recurring: [], plannedPurchases: [],
  allowances: [{ id: 'fun', label: 'Fun', monthly: 200 }],
  income: [{ date: '2026-09-18', amount: 1800 }, { date: '2026-10-02', amount: 1800 }],
  goal: { label: 'Emergency fund', target: 2000, saved: 800, planned: 300, targetDate: '2026-12-18' } };
const draft = { label: 'Family trip', amount: 1200, date: '2026-09-14', accountId: 'checking', allowanceId: 'fun' };
it('works backward from the dated cash shortage without promising unfundable goal savings', () => {
  const plan = emptyPlan(), before = structuredClone({ base, plan });
  const result = purchaseImpact(base, plan, { draft });
  expect(result.funding).toMatchObject({ fits: false, low: -685, neededToAvoidNegative: 685,
    neededToKeepCushion: 885, maxAmount: 315, laterDate: '2026-09-18', withoutSavingLow: -685 });
  expect(result.funding.options.map(o => o.kind)).toEqual(['later', 'smaller']);
  for (const option of result.funding.options) {
    const checked = purchaseImpact(base, plan, { draft: { ...draft, date: option.date, amount: option.amount } });
    expect(option.low).toBe(checked.funding.low);
    expect(option.low).toBeGreaterThanOrEqual(base.cushion);
    expect(option.checkedThrough).toBe(checked.funding.checkedThrough);
    expect(checked.after.contribution).toBe(300);
  }
  expect(purchaseEvidenceDocuments(result).some(e => e.text.includes('2026-09-18') && e.text.includes('1200'))).toBe(true);
  expect(purchaseImpact(base, plan, { draft: { ...draft, amount: result.funding.maxAmount } }).funding.fits).toBe(true);
  expect(purchaseImpact(base, plan, { draft: { ...draft, amount: result.funding.maxAmount + .01 } }).funding.fits).toBe(false);
  expect(purchaseImpact(base, plan, { draft: { ...draft, date: result.funding.laterDate } }).funding.fits).toBe(true);
  expect({ base, plan }).toEqual(before);
});
it('checks purchases after both the short forecast and the goal deadline', () => {
  const h = { ...base, income: [], allowances: [], goal: { ...base.goal, target: 800, planned: 0, targetDate: '2026-09-30' } };
  const result = purchaseImpact(h, emptyPlan(), { draft: { ...draft, allowanceId: null, date: '2026-12-20' } });
  expect(result.after.low).toBe(515);
  expect(result.funding).toMatchObject({ fits: false, low: -685, lowDate: '2026-12-20', maxAmount: 315, laterDate: null });
  expect(result.funding.checkedThrough >= '2026-12-20').toBe(true);
  const evidence = purchaseEvidenceDocuments(result), brief = reviewBrief(result, { kind: 'purchase', question: 'Does it fit?' }, evidence);
  expect(brief.after.contributionFits).toBe(false);
  expect(brief.after.goalFeasible).toBe(false);
  expect(brief.after.checkedThrough).toBe(result.funding.checkedThrough);
  expect(evidence[0].text.length).toBeLessThanOrEqual(700);
});
it('does not invent an affordable purchase limit when the existing budget already fails', () => {
  const result = purchaseImpact({ ...base, checking: 100 }, emptyPlan(), { draft });
  expect(result.funding.baselineFits).toBe(false);
  expect(result.funding.maxAmount).toBeNull();
});

it('finds a later funded payday even when the next three are insufficient', () => {
  const h = { ...base, checking: 1000, allowances: [],
    income: [{ date: '2026-09-18', amount: 500 }, { date: '2026-10-02', amount: 500 }],
    goal: { ...base.goal, target: 800, planned: 0, targetDate: '2026-09-30' } };
  const patch = { draft: { ...draft, amount: 2500, allowanceId: null } };
  const impact = purchaseImpact(h, emptyPlan(), patch);
  expect(impact.funding.laterDate).toBe('2026-10-30');
  expect(purchaseImpact(h, emptyPlan(), { draft: { ...patch.draft, date: impact.funding.laterDate } }).funding.fits).toBe(true);
});
