import { expect, it } from 'vitest';
import { recoveryProjection } from '../src/engine/budget-recovery.js';
const h = { today: '2026-09-01', windowDays: 34, spendingPeriod: 'calendar-month', checking: 5000, cushion: 200,
  allowances: [{ id: 'dining', label: 'Dining', monthly: 300 }], recurring: [], income: [], goal: {} };
const objective = { amount: 660, deadline: '2026-12-31' };
const sc = { contribution: 300 };
it('works backward from the recovery objective and does not confuse $39.05 with $660 recovered', () => {
  const r = recoveryProjection(h, sc, { ...sc, cuts: { dining: 39.05 } }, objective);
  expect(r).toMatchObject({ amount: 660, requiredMonthly: 165, projected: 156.2, remaining: 503.8, complete: false });
  expect(r.extraMonthlyNeeded).toBe(125.95);
  expect(r.laterDate).toBeTruthy();
});
it('counts only the remaining part of the current month', () => {
  const r = recoveryProjection({ ...h, today: '2026-09-13' }, sc, { ...sc, cuts: { dining: 165 } }, objective);
  expect(r.requiredMonthly).toBeGreaterThan(165);
  expect(r.projected).toBeLessThan(660);
  expect(r.complete).toBe(false);
});
it('meets the objective when sufficient cuts exist and never moves saved money', () => {
  const before = JSON.stringify(h);
  expect(recoveryProjection(h, sc, { ...sc, cuts: { dining: 165 } }, objective)).toMatchObject({ projected: 660, remaining: 0, complete: true });
  expect(JSON.stringify(h)).toBe(before);
});
it('does not allocate the same reduction to extra goal savings and recovery', () => {
  const r = recoveryProjection(h, sc, { ...sc, cuts: { dining: 165 } }, objective, 30);
  expect(r.projected).toBe(540);
  expect(r.remaining).toBe(120);
});
it('rejects invalid dates and amounts and has no invented later date when there are no cuts', () => {
  expect(() => recoveryProjection(h, sc, sc, { ...objective, deadline: '2026-02-30' })).toThrow();
  expect(() => recoveryProjection(h, sc, sc, { ...objective, amount: -1 })).toThrow();
  expect(recoveryProjection(h, sc, sc, objective).laterDate).toBeNull();
});
