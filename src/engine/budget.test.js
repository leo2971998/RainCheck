import { describe, it, expect } from 'vitest';
import { emptyPlan, applyPatch, householdFor, revert, undoLatest } from './plan.js';
import { fallsOn, nextChargeDate, simulate, goalPlan } from './forecast.js';
import { readGoal, readSubscription, goalChoices, goalPatch, removeGoalPatch, subscriptionPatch, budgetImpact, BASE_GOAL } from './budget.js';

const h = { today: '2026-09-28', windowDays: 34, checking: 2000, savings: 800, cushion: 200,
  income: [{ date: '2026-10-02', amount: 2000 }, { date: '2026-10-16', amount: 2000 }],
  recurring: [], allowances: [], goal: { label: 'Emergency fund', target: 2000, saved: 800, targetDate: '2027-01-31', planned: 300 } };
const subscription = { label: 'Music', amount: '12.99', startsOn: '2026-10-31' };
const goal = { label: 'Trip', target: '1800', targetDate: '2027-02-01' };

describe('budget changes stay separate from bank records', () => {
  it('validates money, names, dates and a bounded planning horizon', () => {
    expect(readSubscription(subscription, h.today).amount).toBe(12.99);
    for (const amount of ['', '-5', 'Infinity', '1.001', '1e2'])
      expect(() => readSubscription({ ...subscription, amount }, h.today)).toThrow();
    for (const startsOn of ['2026-02-31', '2026-09-01', '2040-01-01'])
      expect(() => readSubscription({ ...subscription, startsOn }, h.today)).toThrow();
    expect(() => readGoal({ ...goal, label: ' ' }, h.today)).toThrow();
    expect(() => readGoal({ ...goal, targetDate: h.today }, h.today)).toThrow();
  });
  it('saves alternatives without reusing the savings in the active forecast', () => {
    const item = readGoal(goal, h.today);
    const saved = applyPatch(emptyPlan(), { goals: { 'goal-trip': item } }).plan;
    expect(goalChoices(h, saved)).toHaveLength(2);
    expect(householdFor(h, saved)).toBe(h);
    const active = applyPatch(saved, goalPatch('goal-trip', item, 200)).plan;
    expect(householdFor(h, active).goal).toMatchObject({ label: 'Trip', saved: 800, target: 1800, planned: 300 });
    expect(active.contribution).toBe(200);
    expect(h.goal.label).toBe('Emergency fund');
  });
  it('adds, edits, removes and undoes only the subscription being changed', () => {
    const first = applyPatch(emptyPlan(), subscriptionPatch('sub-music', readSubscription(subscription, h.today)));
    const second = applyPatch(first.plan, subscriptionPatch('sub-gym', readSubscription({ ...subscription, label: 'Gym' }, h.today)));
    const edited = applyPatch(second.plan, subscriptionPatch('sub-music', readSubscription({ ...subscription, amount: '20' }, h.today)));
    const removed = applyPatch(edited.plan, subscriptionPatch('sub-music', null));
    expect(householdFor(h, removed.plan).recurring.map(r => r.id)).toEqual(['sub-gym']);
    expect(householdFor(h, revert(removed.plan, JSON.parse(JSON.stringify(removed.entry)))).recurring.find(r => r.id === 'sub-music').amount).toBe(20);
    expect(h.recurring).toHaveLength(0);
  });
  it('previews the same applied result without changing the original plan', () => {
    const plan = emptyPlan();
    const patch = subscriptionPatch('sub-music', readSubscription({ ...subscription, startsOn: h.today }, h.today));
    const impact = budgetImpact(h, plan, patch);
    expect(impact.after.low).toBe(impact.before.low - 12.99);
    expect(impact.after.monthlyBills - impact.before.monthlyBills).toBe(12.99);
    expect(plan.subscriptions).toEqual({});
    expect(impact.after.goalLabel).toBe('Emergency fund');
  });
  it('does not request negative contributions for an already funded goal', () => {
    const g = goalPlan(h, {}, { target: 500, saved: 800, targetDate: '2027-01-31' });
    expect(g.required).toBe(0);
    expect(g.contribution).toBe(0);
    expect(g.projected).toBe(800);
  });
  it('does not invent an extra cent when calculating the required contribution', () => {
    expect(goalPlan(h, {}, { target: 800.07, saved: 800, targetDate: '2026-10-03' }).required).toBe(0.07);
  });
  it('preserves the starting idea without silently funding it when the old active goal is removed', () => {
    const baseline = readGoal({ ...goal, label: 'Rainy day fund' }, h.today);
    let plan = applyPatch(emptyPlan(), goalPatch(BASE_GOAL, baseline, 200)).plan;
    expect(householdFor(h, plan).goal.label).toBe('Rainy day fund');
    plan = applyPatch(plan, goalPatch('goal-trip', readGoal(goal, h.today), 200)).plan;
    const removed = applyPatch(plan, removeGoalPatch(h, plan, 'goal-trip'));
    expect(householdFor(h, removed.plan).fundedGoals).toEqual([]);
    expect(goalChoices(h, removed.plan)[0].label).toBe('Rainy day fund');
    expect(goalChoices(h, removed.plan)).toHaveLength(1);
    expect(householdFor(h, revert(removed.plan, removed.entry)).goal.label).toBe('Trip');
  });
  it('labels a deadline before the next payday as not currently reachable', () => {
    const g = goalPlan(h, {}, { target: 2000, saved: 800, targetDate: '2026-09-29' });
    expect(g.feasible).toBe(false);
    expect(g.assumption).not.toContain('Invalid Date');
    expect(g.assumption).toContain('No contribution');
  });
  it('checks a subscription starting after the last contribution but before the goal deadline', () => {
    const lateBill = { id: 'sub-late', label: 'Late bill', day: 20, amount: 50000, startsOn: '2027-01-20' };
    const g = goalPlan({ ...h, recurring: [lateBill] }, {}, { target: 2000, saved: 800, targetDate: '2027-01-31', contribution: 0 });
    expect(g.fits).toBe(false);
    expect(g.checkedThrough).toBe('2027-01-31');
    expect(g.low.key).toBe('2027-01-20');
  });
  it('does not let an old Undo notification erase newer decisions', () => {
    const first = applyPatch(emptyPlan(), subscriptionPatch('sub-first', readSubscription(subscription, h.today)));
    first.entry.at = 1;
    const second = applyPatch(first.plan, subscriptionPatch('sub-second', readSubscription(subscription, h.today)));
    second.entry.at = 2;
    expect(undoLatest(second.plan, [first.entry, second.entry], 1)).toBeNull();
    const undone = undoLatest(second.plan, [first.entry, second.entry], 2);
    expect(householdFor(h, undone.plan).recurring.map(r => r.id)).toEqual(['sub-first']);
    expect(undone.history).toHaveLength(1);
  });
});

describe('subscription billing dates', () => {
  const bill = { ...subscription, amount: 12.99, day: 31, id: 'sub-music', everyMonths: 1 };
  it('never charges before its first billing date', () => {
    expect(nextChargeDate(bill, h.today)).toBe('2026-10-31');
    expect(fallsOn(bill, new Date('2026-09-30T12:00:00'), h.today)).toBe(false);
    expect(simulate({ ...h, recurring: [bill] }, {}, { days: 33 }).cash.bills).toBe(0);
  });
  it('uses the last day of shorter months, consistently in the forecast and next charge', () => {
    expect(nextChargeDate(bill, '2026-11-01')).toBe('2026-11-30');
    expect(fallsOn(bill, new Date('2026-11-30T12:00:00'), h.today)).toBe(true);
    expect(nextChargeDate(bill, '2027-02-01')).toBe('2027-02-28');
  });
});
