import { expect, it } from 'vitest';
import { household as sample } from '../data/household.sample.js';
import { emptyPlan, applyPatch, revert } from '../src/engine/plan.js';
import { savingsPreview } from '../src/engine/savings-plan.js';

const base = { ...sample, allowances: [{ id: 'dining', label: 'Dining', monthly: 180 }, { id: 'groceries', label: 'Groceries', monthly: 700 }] };
it('previews a budget reduction without counting freed money as saved or changing bank balances', () => {
  const plan = emptyPlan(), before = JSON.stringify({ base, plan });
  const preview = savingsPreview(base, plan, { targets: { dining: 140 }, extras: {} });
  expect(preview).toMatchObject({ freed: 40, extraSavings: 0, remainingInChecking: 40, patch: { cuts: { dining: 40 } } });
  expect(preview.impact.after.contribution).toBe(preview.impact.before.contribution);
  expect(JSON.stringify({ base, plan })).toBe(before);
});
it('adds only the newly freed amount to a chosen goal and preserves every other goal', () => {
  const plan = { ...emptyPlan(), cuts: { dining: 20 }, goals: { trip: { label: 'Trip', target: 500, targetDate: '2027-02-01' } },
    goalFunding: { 'emergency-fund': { monthly: 300, saved: 800, active: true }, trip: { monthly: 50, saved: 0, active: true } } };
  const p = savingsPreview(base, plan, { targets: { dining: 140 }, extras: { trip: 20 } });
  expect(p.freed).toBe(20);
  expect(p.patch.goalFunding.trip).toEqual({ monthly: 70, saved: 0, active: true });
  expect(p.patch.goalFunding['emergency-fund']).toEqual(plan.goalFunding['emergency-fund']);
  expect(p.impact.after.contribution).toBe(370);
  const saved = applyPatch(plan, p.patch, 'Savings plan updated');
  expect(revert(saved.plan, saved.entry)).toEqual(plan);
});
it('keeps protected categories and fixed bills out of a reduction', () => {
  expect(() => savingsPreview(base, emptyPlan(), { targets: { groceries: 600 } }, { groceries: true })).toThrow('protected');
  expect(() => savingsPreview(base, emptyPlan(), { targets: { rent: 100 } })).toThrow();
});
it('rejects excess savings, negative budgets, invalid cents and inactive goals', () => {
  for (const draft of [{ targets: { dining: [] } }, { targets: { dining: '   ' } }, { targets: { dining: -1 } }, { targets: { dining: 180.01 } }, { targets: { dining: 140.001 } },
    { targets: { dining: 140 }, extras: { 'emergency-fund': 41 } }, { extras: { missing: 10 } }])
    expect(() => savingsPreview(base, emptyPlan(), draft)).toThrow();
  const plan = { ...emptyPlan(), goalFunding: { 'emergency-fund': { monthly: 0, saved: 800, active: false } } };
  expect(() => savingsPreview(base, plan, { targets: { dining: 140 }, extras: { 'emergency-fund': 10 } })).toThrow();
});
it('handles a cent-sized proposal without manufacturing extra money', () => {
  const p = savingsPreview(base, emptyPlan(), { targets: { dining: 179.99 }, extras: { 'emergency-fund': .01 } });
  expect(p.freed).toBe(.01); expect(p.extraSavings).toBe(.01); expect(p.remainingInChecking).toBe(0);
});
it('preserves a legacy edited goal target and deadline when adding planned savings', () => {
  const plan = { ...emptyPlan(), goalTarget: 3500, goalDate: '2027-06-01' };
  const p = savingsPreview(base, plan, { targets: { dining: 140 }, extras: { 'emergency-fund': 20 } });
  expect(p.impact.after.target).toBe(3500);
  expect(p.impact.after.targetDate).toBe('2027-06-01');
});
