import { expect, it } from 'vitest';
import { household as sample } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { optimizationDraft, savingsPreview } from '../src/engine/savings-plan.js';

const base = { ...sample, today: '2026-09-13', checking: 10000, savings: 800, recurring: [],
  spendingModel: null, income: [{ date: '2026-09-18', amount: 1800 }],
  goal: { label: 'Emergency fund', target: 2000, saved: 800, planned: 300, targetDate: '2026-12-18' },
  allowances: [{ id: 'household', label: 'Household', monthly: 176 }, { id: 'dining', label: 'Dining', monthly: 200 }],
  spendingEvidence: { asOf: '2026-09-13', months: ['2026-07', '2026-08', '2026-09'], baselineMonths: ['2026-07', '2026-08'],
    categories: [{ id: 'household', count: 8, total: 1188, months: [
      { key: '2026-07', total: 176 }, { key: '2026-08', total: 176 }, { key: '2026-09', total: 836, spent: 836 },
    ] }, { id: 'dining', count: 8, total: 480, months: [
      { key: '2026-07', total: 200 }, { key: '2026-08', total: 200 }, { key: '2026-09', total: 80, spent: 80 },
    ] }] } };

it('does not suggest a lower Household limit as a repair for money already spent', () => {
  const draft = optimizationDraft(base, emptyPlan());
  expect(draft.targets.household).toBe(176);
  expect(draft.targets.dining).toBe(160);
  const p = savingsPreview(base, emptyPlan(), draft);
  expect(p.guidance.overBudget).toMatchObject([{ id: 'household', spent: 836, budget: 176, over: 660 }]);
  expect(p.guidance.goals[0]).toMatchObject({ label: 'Emergency fund', remaining: 1200, needed: 300, planned: 300, extraNeeded: 0, paymentsLeft: 4 });
  expect(p.guidance.additionalNeeded).toBe(0);
  expect(p.extraSavings).toBe(0);
  expect(p.freed).toBe(40);
});

it('connects a feasible monthly goal gap to proposed cuts without moving money', () => {
  const plan = { ...emptyPlan(), contribution: 270 };
  const before = JSON.stringify({ base, plan });
  const draft = optimizationDraft(base, plan);
  expect(draft.extras).toEqual({ 'emergency-fund': 30 });
  const p = savingsPreview(base, plan, draft);
  expect(p.guidance).toMatchObject({ additionalNeeded: 30, remainingNeeded: 0, uncoveredByCuts: 0 });
  expect(p.impact.after.contribution).toBe(300);
  expect(p.extraSavings).toBe(30);
  expect(p.remainingInChecking).toBe(10);
  expect(JSON.stringify({ base, plan })).toBe(before);
});

it('does not spend the same proposed cuts twice or automatically choose between underfunded goals', () => {
  const plan = { ...emptyPlan(), goals: { trip: { label: 'Trip', target: 200, targetDate: '2026-12-18' } },
    goalFunding: { 'emergency-fund': { active: true, monthly: 270, saved: 800 }, trip: { active: true, monthly: 0, saved: 0 } } };
  const draft = optimizationDraft(base, plan);
  expect(draft.extras).toEqual({}); // $40 of cuts cannot cover the combined $80/month gap.
  const p = savingsPreview(base, plan, draft);
  expect(p.guidance).toMatchObject({ additionalNeeded: 80, remainingNeeded: 80, uncoveredByCuts: 40 });
  const edited = savingsPreview(base, plan, { ...draft, extras: { trip: 20 } });
  expect(edited.guidance.remainingNeeded).toBe(60);
  expect(edited.remainingInChecking).toBe(20);
});

it('does not recommend extra contributions when the dated forecast still runs short', () => {
  const h = { ...base, checking: 0 }, plan = { ...emptyPlan(), contribution: 270 };
  const draft = optimizationDraft(h, plan);
  expect(draft.extras).toEqual({});
  const p = savingsPreview(h, plan, draft);
  expect(p.impact.after.fits).toBe(false);
  expect(p.impact.after.fundingLow).toBeLessThan(h.cushion);
  expect(p.impact.after.fundingLowDate).toBeTruthy();
  expect(p.guidance.remainingNeeded).toBe(30);
});

it('shows the remaining-month benefit separately from a full monthly cut', () => {
  const p = savingsPreview(base, emptyPlan(), { targets: { dining: 160 }, extras: {} });
  expect(p.freed).toBe(40);
  expect(p.guidance.thisMonthReduction).toBe(24); // 18 of 30 days, not $40 recovered from past purchases.
  const before = savingsPreview({ ...base, checking: 500 }, emptyPlan(), { targets: {}, extras: {} });
  const changedHistory = structuredClone(base);
  changedHistory.checking = 500;
  changedHistory.spendingEvidence.categories[0].months[2].spent = 1000;
  const after = savingsPreview(changedHistory, emptyPlan(), { targets: {}, extras: {} });
  expect(after.impact).toEqual(before.impact); // Recorded spending is already in checking, never charged twice.
});

it('keeps absent payday dates unknown and ignores paused or completed goals', () => {
  const p = savingsPreview({ ...base, income: [] }, emptyPlan(), { targets: {}, extras: {} });
  expect(p.guidance.additionalNeeded).toBeNull();
  expect(p.guidance.goals[0].needed).toBeNull();
  const plan = { ...emptyPlan(), goalFunding: { 'emergency-fund': { active: false, monthly: 300, saved: 800 } } };
  const paused = savingsPreview(base, plan, { targets: {}, extras: {} });
  expect(paused.guidance.goals).toEqual([]);
  expect(paused.guidance.additionalNeeded).toBe(0);
});

it('uses the existing legacy schedule when a month-end payday rolls into the next month', () => {
  const h = { ...base, today: '2026-01-30', income: [{ date: '2026-01-31', amount: 1800 }],
    goal: { ...base.goal, targetDate: '2026-02-28' } };
  const p = savingsPreview(h, emptyPlan(), { targets: {}, extras: {} });
  expect(p.guidance.goals[0].needed).toBe(p.impact.before.required);
  expect(p.guidance.goals[0].paymentsLeft).toBe(1);
});
