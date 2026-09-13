import { expect, it } from 'vitest';
import { spendingBaseline } from '../src/engine/spending-baseline.js';
import { spendingInsights } from '../src/engine/spending-insights.js';

const row = (id, date, amount, description = '') => ({ _id: id, payer_id: 'checking', merchant_id: 'dining', purchase_date: date, amount, description });
const snap = { checkingId: 'checking', bills: [], merchants: [{ _id: 'dining', name: 'Dining place', category: 'Dining' }],
  purchases: [row('j1', '2026-07-03', 40), row('j2', '2026-07-12', 40), row('j3', '2026-07-26', 20),
    row('a1', '2026-08-03', 40), row('a2', '2026-08-12', 40), row('a3', '2026-08-26', 20),
    row('s1', '2026-09-03', 40), row('s2', '2026-09-10', 40), row('s3', '2026-09-12', 15)] };
function household(snapshot = snap, today = '2026-09-18') {
  const result = spendingBaseline(snapshot, today);
  return { today, allowances: result.allowances, spendingEvidence: result.evidence, recurring: [] };
}

it('keeps one-time purchases in actual spending without repeating them in the regular baseline', () => {
  const h = household({ ...snap, purchases: [...snap.purchases, row('concert', '2026-09-13', 50, 'Concert tickets')] });
  const c = spendingInsights(h, {}).categories[0];
  expect(c).toMatchObject({ spent: 145, usual: 100, budget: 100, oneOff: 50, remaining: 0, over: 45, count: 4 });
  expect(c.projected).toBeCloseTo(168.75); // 95 / 80% historical timing + this one-time 50, not 145 / 80%.
});
it('uses historical purchase timing instead of declaring 80% spent a problem', () => {
  const c = spendingInsights(household(), {}).categories[0];
  expect(c).toMatchObject({ spent: 95, budget: 100, remaining: 5, expectedByNow: 80, status: 'pace' });
  const steady = household({ ...snap, purchases: snap.purchases.map(p => p._id === 's1' ? { ...p, amount: 25 } : p) });
  expect(spendingInsights(steady, {}).categories[0].status).toBe('within');
});
it('does not extrapolate early in the month or from missing history', () => {
  const early = spendingInsights(household(snap, '2026-09-04'), {}).categories[0];
  expect(early.projected).toBeNull();
  expect(early.status).toBe('early');
  const missing = spendingInsights({ today: '2026-09-18', allowances: [{ id: 'food', label: 'Food', monthly: 100 }] }, {});
  expect(missing.available).toBe(false);
  expect(missing.categories[0].spent).toBeNull();
});
it('includes zero-spend categories, saved budget cuts and protected-category preferences', () => {
  const h = household(); h.allowances.push({ id: 'transport', label: 'Transport', monthly: 100 });
  const a = spendingInsights(h, { cuts: { dining: 10 } }, { dining: true });
  expect(a.categories.find(c => c.id === 'dining')).toMatchObject({ budget: 90, over: 5, protected: true, suggestedCut: 0 });
  expect(a.categories.find(c => c.id === 'transport')).toMatchObject({ spent: 0, budget: 100, suggestedCut: 0 });
});
it('never treats a recurring bill as a flexible spending suggestion', () => {
  const h = household({ ...snap, bills: [{ payee: 'Dining place' }] });
  expect(spendingInsights(h, {}).categories).toHaveLength(0);
});
it('counts pending, foreign-account and future purchases neither as actual spending nor evidence', () => {
  const h = household({ ...snap, purchases: [...snap.purchases,
    { ...row('pending', '2026-09-15', 500), status: 'pending' },
    { ...row('foreign', '2026-09-15', 500), payer_id: 'other' }, row('future', '2026-09-30', 500)] });
  expect(spendingInsights(h, {}).spent).toBe(95);
});
it('does not call a category overspent when its charges have been moved to recurring bills', () => {
  const h = household(); h.allowances[0] = { ...h.allowances[0], monthly: 50, reclaimed: 50 };
  const a = spendingInsights(h, {});
  expect(a.categories[0]).toMatchObject({ status: 'reclassified', spent: null, projected: null, over: 0, suggestedCut: 0 });
  expect(a.spent).toBeNull(); expect(a.remaining).toBeNull();
});
