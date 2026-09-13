import { describe, expect, it } from 'vitest';
import { simulate, goalPlan } from '../src/engine/forecast.js';
import { readPurchase, purchaseSchedule, matchCandidates, confirmPurchaseMatch, purchaseState } from '../src/engine/purchases.js';

const base = { today: '2026-10-01', windowDays: 31, checking: 1000, cushion: 200, checkingId: 'checking',
  income: [{ date: '2026-10-02', amount: 100, label: 'Paycheck' }], recurring: [],
  allowances: [{ id: 'fun', label: 'Fun', monthly: 300 }], plannedPurchases: [] };
const item = changes => ({ id: 'test', label: 'Concert tickets', merchant: 'Ticket shop', amount: 200,
  date: '2026-10-10', accountId: 'checking', allowanceId: null, status: 'planned', ...changes });
const transaction = changes => ({ id: 'purchase:one', accountId: 'checking', amount: -200, date: '2026-10-11',
  description: 'Ticket shop', status: 'completed', sourceType: 'purchase', kind: 'purchase', ...changes });

describe('planned purchase forecast', () => {
  it('subtracts an extra purchase once, on its date, across short and goal horizons', () => {
    const h = { ...base, plannedPurchases: [item()] };
    const baseline = simulate(base, {}), sim = simulate(h, {});
    expect(sim.days[8].balance).toBe(baseline.days[8].balance);
    expect(sim.days[9].balance).toBe(baseline.days[9].balance - 200);
    expect(sim.cash.purchases).toBe(200);
    const longer = simulate(h, {}, { days: 100 });
    expect(longer.days.flatMap(d => d.events).filter(e => e.purchase)).toHaveLength(1);
    const g = { target: 1500, targetDate: '2027-01-02', saved: 0, contribution: 300 };
    expect(goalPlan(h, {}, g).supported).toBeLessThanOrEqual(goalPlan(base, {}, g).supported);
  });
  it('moves covered spending to the purchase date instead of charging the allowance twice', () => {
    const h = { ...base, plannedPurchases: [item({ allowanceId: 'fun' })] };
    const sim = simulate(h, {}), baseline = simulate(base, {});
    expect(sim.days.at(-1).balance).toBe(baseline.days.at(-1).balance);
    expect(sim.cash.purchases + sim.cash.everyday).toBeCloseTo(baseline.cash.everyday, 2);
    expect(sim.days[9].balance).toBeLessThan(baseline.days[9].balance);
    expect(purchaseSchedule(h, {}).allocations.test.covered).toBe(200);
  });
  it('caps allowance coverage after cuts and several purchases; the rest is additional spending', () => {
    const h = { ...base, plannedPurchases: [item({ amount: 200, allowanceId: 'fun' }), item({ id: 'other', amount: 200, allowanceId: 'fun' })] };
    const schedule = purchaseSchedule(h, { cuts: { fun: 150 } });
    expect(Object.values(schedule.allocations).reduce((s, a) => s + a.covered, 0)).toBe(155);
    const sim = simulate(h, { cuts: { fun: 150 } });
    expect(sim.cash.everyday).toBe(0); expect(sim.cash.purchases).toBe(400);
  });
  it('keeps overdue items reserved today until a person resolves them', () => {
    const h = { ...base, plannedPurchases: [item({ date: '2026-09-28' })] };
    expect(purchaseState(h.plannedPurchases[0], h.today)).toBe('overdue');
    expect(simulate(h, {}).days[0].events.some(e => e.purchase && e.amt === -200)).toBe(true);
  });
  it('never subtracts completed or removed estimates from a bank balance again', () => {
    const postedBase = { ...base, checking: 800, plannedPurchases: [item({ status: 'completed' }), item({ id: 'gone', status: 'cancelled' })] };
    expect(simulate(postedBase, {}).days).toEqual(simulate({ ...base, checking: 800 }, {}).days);
  });
});

describe('input and human-confirmed reconciliation', () => {
  it('validates cents, dates, name and checking ownership', () => {
    const draft = item();
    expect(readPurchase(draft, base)).toMatchObject({ label: 'Concert tickets', amount: 200 });
    for (const patch of [{ amount: 0 }, { amount: true }, { amount: 12.345 }, { date: '2026-02-30' }, { accountId: 'another-user' }, { allowanceId: 'unknown' }, { label: '<script>' }])
      expect(() => readPurchase({ ...draft, ...patch }, base)).toThrow();
  });
  it('suggests only close posted purchases in the same account and never auto-completes', () => {
    const p = item(), rows = [transaction(), transaction({ id: 'pending', status: 'pending' }),
      transaction({ id: 'future', date: '2026-12-01' }), transaction({ id: 'wrong-account', accountId: 'other' }),
      transaction({ id: 'transfer', kind: 'transfer', sourceType: 'withdrawal' }), transaction({ id: 'refund', amount: 200 })];
    expect(matchCandidates(p, rows, [], '2026-10-20').map(t => t.id)).toEqual(['purchase:one']);
    expect(p.status).toBe('planned');
  });
  it('requires confirmation and a fresh eligible transaction; a charge cannot fulfill two plans', () => {
    expect(() => confirmPurchaseMatch(item(), transaction(), [], '2026-10-20', false)).toThrow();
    const matched = confirmPurchaseMatch(item(), transaction(), [], '2026-10-20', true);
    expect(matched).toMatchObject({ status: 'completed', transactionId: 'purchase:one', actualAmount: 200 });
    expect(() => confirmPurchaseMatch(item({ id: 'second' }), transaction(), [matched], '2026-10-20', true)).toThrow();
    expect(() => confirmPurchaseMatch(item(), transaction({ status: 'pending' }), [], '2026-10-20', true)).toThrow();
  });
});
