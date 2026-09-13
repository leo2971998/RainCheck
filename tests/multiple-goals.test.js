import { expect, it } from 'vitest';
import { household as base } from '../data/household.sample.js';
import { emptyPlan, applyPatch, householdFor, scenarioFor, revert } from '../src/engine/plan.js';
import { fundGoalPatch, removeGoalPatch, budgetImpact } from '../src/engine/budget.js';
import { simulate, goalPlan } from '../src/engine/forecast.js';
import { readReviewPlan, householdVersion } from '../api/_review.js';
import { calculateChat } from '../api/_chat.js';
import { buildOptions } from '../src/engine/options.js';
import { chatBrief } from '../src/chat/brief.js';

const trip = { label: 'Trip', target: 500, targetDate: '2027-02-02' };
function sharedPlan() {
  return applyPatch(emptyPlan(), fundGoalPatch(base, emptyPlan(), 'goal-trip', trip,
    { monthly: 50, saved: 0, active: true })).plan;
}
function evaluate(plan, facts = base) {
  const h = householdFor(facts, plan), sc = scenarioFor(h, plan);
  return { h, sc, sim: simulate(h, sc), goal: goalPlan(h, sc, h.goal) };
}

it('adds a goal alongside the existing monthly plan without counting savings twice', () => {
  const plan = sharedPlan(), { h, sc, sim, goal } = evaluate(plan);
  expect(sc.contribution).toBe(350);
  expect(h.goal.saved).toBe(800);
  expect(h.goal.target).toBe(2500);
  const transfers = sim.days.flatMap(d => d.events).filter(e => e.transfer);
  expect(transfers.map(e => [e.goalId, e.amt])).toEqual([['emergency-fund', -300], ['goal-trip', -50]]);
  expect(sim.low.balance).toBe(150);
  expect(goal.goals.find(g => g.id === 'goal-trip').projected).toBe(250);
  expect(goal.goals.find(g => g.id === 'goal-trip').gap).toBe(250);
  expect(goal.gap).toBe(250);
  expect(goal.fits).toBe(false);
});

it('preserves the old selected goal and leaves saved alternatives paused during migration', () => {
  const old = { ...emptyPlan(), goalId: 'goal-house', goalTarget: 9000, goalDate: '2027-10-02', contribution: 225,
    goals: { 'goal-house': { label: 'House', target: 8000, targetDate: '2027-08-02' }, 'goal-car': { label: 'Car', target: 4000, targetDate: '2027-06-02' } } };
  const next = applyPatch(old, fundGoalPatch(base, old, 'goal-trip', trip, { monthly: 50, saved: 0, active: true })).plan;
  const { goal } = evaluate(next);
  expect(goal.goals.map(g => g.id)).toEqual(['goal-house', 'goal-trip']);
  expect(goal.goals[0]).toMatchObject({ target: 9000, contribution: 225, saved: 800, targetDate: '2027-10-02' });
  expect(next.goals['goal-car'].target).toBe(4000);
});

it('rejects overallocated savings and invalid monthly amounts', () => {
  expect(() => fundGoalPatch(base, emptyPlan(), 'goal-trip', trip, { monthly: 50, saved: 1, active: true })).toThrow(/available|allocated/i);
  for (const monthly of [-1, NaN, 1.001])
    expect(() => fundGoalPatch(base, emptyPlan(), 'goal-trip', trip, { monthly, saved: 0, active: true })).toThrow();
});

it('caps the final payment, stops completed goals, and clamps month-end dates', () => {
  const facts = { ...base, today: '2026-01-31', income: [{ date: '2026-01-31', amount: 1700 }], windowDays: 70 };
  const plan = { ...emptyPlan(), goals: { 'goal-trip': { ...trip, target: 100, targetDate: '2026-04-30' } },
    goalFunding: { 'goal-trip': { monthly: 60, saved: 0, active: true } } };
  const { sim, goal } = evaluate(plan, facts);
  expect(sim.days.flatMap(d => d.events.filter(e => e.transfer).map(e => [d.key, e.amt])))
    .toEqual([['2026-01-31', -60], ['2026-02-28', -40]]);
  expect(goal.projected).toBe(100);
  expect(goal.goals[0].payments.map(p => p.amount)).toEqual([60, 40]);
  expect(sim.contributionDates).toEqual(['2026-01-31', '2026-02-28']);
});

it('edits only the chosen goal and undo restores both allocation and totals', () => {
  const plan = sharedPlan();
  const change = applyPatch(plan, fundGoalPatch(base, plan, 'goal-trip', trip, { monthly: 20, saved: 0, active: true }));
  expect(evaluate(change.plan).sc.contribution).toBe(320);
  expect(change.plan.goalFunding['emergency-fund'].monthly).toBe(300);
  expect(revert(change.plan, change.entry)).toEqual(plan);
});

it('rechecks all goals after a cost spike without reducing anyone’s savings automatically', () => {
  const plan = sharedPlan();
  const impact = budgetImpact(base, plan, { subscriptions: { 'sub-test': { id: 'sub-test', label: 'New cost', amount: 25, day: 1, startsOn: '2026-10-01', everyMonths: 1 } } });
  expect(impact.after.contribution).toBe(350);
  expect(impact.after.low).toBe(impact.before.low - 25);
  expect(impact.after.goals.map(g => g.contribution)).toEqual([300, 50]);
  expect(impact.after.fits).toBe(false);
});

it('validates shared goals server-side and gives the chatbot per-goal results', () => {
  const plan = sharedPlan();
  expect(readReviewPlan(plan, base).goalFunding).toEqual(plan.goalFunding);
  expect(() => readReviewPlan({ ...plan, goalFunding: { ...plan.goalFunding, 'goal-trip': { monthly: 50, saved: 800, active: true } } }, base)).toThrow();
  const result = calculateChat(base, { consent: true, baseVersion: householdVersion(base), plan, tool: 'get_current_plan', args: {} });
  expect(result.impact.after.goals).toHaveLength(2);
  expect(result.impact.after.contribution).toBe(350);
  const brief = chatBrief(result);
  expect(brief).toContain('separate deadlines');
  expect(brief).toContain('Trip: $50.00/month');
  expect(brief).toContain('Emergency fund: $300.00/month');
});

it('never offers a global savings cut or one combined deadline for independent goals', () => {
  const { h, sc } = evaluate(sharedPlan());
  const options = buildOptions(h, sc, 300);
  expect(options.some(o => ['keep', 'date'].includes(o.id))).toBe(false);
  for (const option of options.filter(o => !o.disabled)) {
    expect(option.apply.contribution).toBeUndefined();
    expect(option.apply.goalDate).toBeUndefined();
  }
});

it('keeps paused savings reserved, while deleting a goal releases only its own allocation', () => {
  const plan = sharedPlan();
  const paused = applyPatch(plan, fundGoalPatch(base, plan, 'emergency-fund', base.goal, { monthly: 300, saved: 800, active: false })).plan;
  expect(evaluate(paused).sc.contribution).toBe(50);
  expect(() => fundGoalPatch(base, paused, 'goal-trip', trip, { monthly: 50, saved: 100, active: true })).toThrow();
  const deleted = applyPatch(paused, removeGoalPatch(base, paused, 'goal-trip')).plan;
  expect(evaluate(deleted).goal.goals).toEqual([]);
  expect(evaluate(deleted).sc.contribution).toBe(0);
  expect(deleted.goalFunding['emergency-fund'].saved).toBe(800);
});

it('does not invent a contribution without expected income', () => {
  const { goal, sim } = evaluate(sharedPlan(), { ...base, income: [] });
  expect(goal.payments).toEqual([]);
  expect(goal.projected).toBe(800);
  expect(goal.goals.every(g => g.required === null)).toBe(true);
  expect(sim.cash.savings).toBe(0);
  expect(sim.contributionDate).toBeNull();
});

it('uses month-end contribution dates when calculating the required monthly saving', () => {
  const facts = { ...base, today: '2026-01-31', income: [{ date: '2026-01-31', amount: 1700 }], windowDays: 34 };
  const plan = { ...emptyPlan(), goals: { 'goal-trip': { ...trip, target: 100, targetDate: '2026-02-28' } },
    goalFunding: { 'goal-trip': { monthly: 50, saved: 0, active: true } } };
  expect(evaluate(plan, facts).goal.goals[0].required).toBe(50);
});
