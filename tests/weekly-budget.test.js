import { expect, it } from 'vitest';
import { weeklyBudget, activitySummary } from '../src/engine/weekly-budget.js';

const h = { today: '2026-09-28', checking: 700, savings: 800, cushion: 100, windowDays: 34,
  spendingPeriod: 'calendar-month', allowances: [{ id: 'food', label: 'Groceries', monthly: 930 }],
  recurring: [{ id: 'bill', label: 'Internet', amount: 90, day: 1 }], income: [],
  goal: { label: 'Emergency fund', saved: 800, target: 2000, planned: 200 },
  activity: { asOf: '2026-09-28', week: { spent: 0 }, month: { income: 1000, spent: 300 } } };

it('shows only the Monday–Sunday week containing the snapshot date', () => {
  const w = weeklyBudget(h, { contribution: 0 });
  expect(w).toMatchObject({ start: '2026-09-28', end: '2026-10-04', budget: 213, spent: 0, available: 213, state: 'ok' });
  expect(w.bills).toHaveLength(1);
});
it('reserves bills and monthly savings before reporting money left for everyday spending', () => {
  const w = weeklyBudget({ ...h, checking: 478 }, { contribution: 200, contributionDates: ['2026-10-02'] });
  // 478 checking - 90 bill - 200 saving - 100 buffer = 88 available; 213 budget needs 125 more.
  expect(w).toMatchObject({ available: 88, savings: 200, shortfall: 125, state: 'below' });
});
it('does not count a future paycheck as money already available to spend', () => {
  const w = weeklyBudget({ ...h, checking: 150, income: [{ date: '2026-10-02', amount: 1000 }] }, { contribution: 200 });
  expect(w.available).toBe(0); // Thursday bill must still be covered before Friday income.
  expect(w.expectedIncome).toBe(1000);
});
it('does not make this week rainy because of a bill or goal payment in a later week', () => {
  const w = weeklyBudget({ ...h, recurring: [...h.recurring, { id: 'later', label: 'Later bill', amount: 5000, day: 15 }] },
    { contribution: 1000, contributionDates: ['2026-10-16'] });
  expect(w.state).toBe('ok');
  expect(w.savings).toBe(0);
  expect(w.bills.map(b => b.id)).toEqual(['bill']);
});
it('uses recorded spending so far once, rather than treating it as new future spending', () => {
  const facts = { ...h, today: '2026-09-30', activity: { asOf: '2026-09-30', week: { spent: 80 } } };
  expect(weeklyBudget(facts, { contribution: 0 })).toMatchObject({ budget: 213, spent: 80, available: 133 });
});
it('reserves a planned purchase once and restores room when it is removed', () => {
  const p = { id: 'p', label: 'Groceries', amount: 50, date: '2026-10-03', status: 'planned', allowanceId: 'food' };
  const w = weeklyBudget({ ...h, plannedPurchases: [p] }, { contribution: 0 });
  expect(w).toMatchObject({ available: 163, purchasesTotal: 50, covered: 50 });
  expect(weeklyBudget(h, { contribution: 0 }).available - w.available).toBe(50);
});
it('distinguishes running short from needing savings or the safety reserve', () => {
  expect(weeklyBudget({ ...h, checking: 100 }, { contribution: 0 }).state).toBe('over');
  const safe = weeklyBudget({ ...h, checking: 700 }, { contribution: 0 });
  expect(safe.state).toBe('ok');
  expect(safe.shortfall).toBe(0);
});
it('summarizes the full posted history, excluding transfers, future rows and other accounts', () => {
  const snap = { checkingId: 'a', merchants: [], bills: [], withdrawals: [],
    deposits: [{ _id: 'pay', account_id: 'a', transaction_date: '2026-09-01', amount: 1000, description: 'Payroll' },
      { _id: 'transfer', account_id: 'a', transaction_date: '2026-09-01', amount: 500, description: 'Transfer' }],
    purchases: Array.from({ length: 40 }, (_, i) => ({ _id: String(i), payer_id: 'a', purchase_date: '2026-09-28', amount: 1 })) };
  snap.purchases.push({ _id: 'future', payer_id: 'a', purchase_date: '2026-10-01', amount: 200 },
    { _id: 'foreign', payer_id: 'b', purchase_date: '2026-09-28', amount: 100 });
  expect(activitySummary(snap, h.today)).toMatchObject({ asOf: h.today, week: { spent: 40 }, month: { income: 1000, spent: 40 } });
});
