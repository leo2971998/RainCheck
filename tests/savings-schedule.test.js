import { describe, expect, it } from 'vitest';
import { household as base } from '../data/household.sample.js';
import { emptyPlan, applyPatch, householdFor, scenarioFor } from '../src/engine/plan.js';
import { fundGoalPatch } from '../src/engine/budget.js';
import { goalPlan } from '../src/engine/forecast.js';
import { savingsRuns, goalMath, combinedMath, monthsLate } from '../src/engine/savings-schedule.js';

/** The sample household saves for an emergency fund; this adds a second goal with a later date. */
function twoGoals(monthly = 120) {
  let plan = emptyPlan();
  plan = applyPatch(plan, fundGoalPatch(base, plan, 'goal-laptop',
    { label: 'New laptop', target: 1400, targetDate: '2027-06-30' }, { monthly, saved: 0, active: true })).plan;
  const h = householdFor(base, plan), sc = scenarioFor(h, plan);
  return goalPlan(h, sc, h.goal);
}

describe('what two deadlines actually cost, month by month', () => {
  it('steps the monthly total down when the nearer goal closes', () => {
    const runs = savingsRuns(twoGoals());
    expect(runs).toHaveLength(2);
    // Both goals run together until the emergency fund's January deadline...
    expect(runs[0]).toMatchObject({ from: '2026-10', to: '2027-01', months: 4, total: 420 });
    expect(runs[0].parts.map(p => p.label).sort()).toEqual(['Emergency fund', 'New laptop']);
    // ...then only the laptop is left, and the household keeps $300 a month it did not have before.
    expect(runs[1]).toMatchObject({ from: '2027-02', to: '2027-06', months: 5, total: 120 });
    expect(runs[1].parts).toEqual([{ label: 'New laptop', amount: 120 }]);
  });

  it('gives one run when one goal funds one deadline', () => {
    let plan = emptyPlan();
    const h = householdFor(base, plan), sc = scenarioFor(h, plan);
    const runs = savingsRuns(goalPlan(h, sc, h.goal));
    expect(runs.length).toBeLessThanOrEqual(1);
    if (runs.length) expect(new Set(runs[0].parts.map(p => p.label)).size).toBe(1);
  });
});

describe('the monthly amount each deadline asks for', () => {
  it('works out what is needed, what is planned, and when the plan would really land', () => {
    const math = goalMath(twoGoals());
    const laptop = math.find(g => g.label === 'New laptop');
    // $1,400 over the contribution dates before June 30 is more than the $120 that was entered.
    expect(laptop.needed).toBe(155.56);
    expect(laptop.planned).toBe(120);
    expect(laptop.extra).toBe(35.56);
    expect(laptop.onTrack).toBe(false);
    expect(laptop.short).toBe(320);
    expect(monthsLate(laptop.finish, laptop.targetDate)).toBe(3);

    const fund = math.find(g => g.label === 'Emergency fund');
    expect(fund.onTrack).toBe(true);
    expect(fund.needed).toBe(fund.planned);
    expect(monthsLate(fund.finish, fund.targetDate)).toBe(0);
  });

  it('reports no shortfall once each goal funds its own deadline', () => {
    const math = goalMath(twoGoals(155.56));
    expect(math.every(g => g.onTrack)).toBe(true);
    expect(math.every(g => g.extra === 0)).toBe(true);
  });

  it('adds the required amounts up and checks the total against what the forecast supports', () => {
    const goal = twoGoals();
    const combined = combinedMath(goal, goalMath(goal));
    expect(combined.needed).toBe(455.56);
    expect(combined.planned).toBe(420);
    expect(combined.supported).toBe(goal.supported);
    expect(combined.affordable).toBe(combined.needed <= goal.supported);
  });

  // A goal already met asks for nothing; dividing its remaining months would say otherwise.
  it('asks for nothing once a goal is fully saved', () => {
    const done = goalMath({ goals: [{ id: 'deposit', label: 'Deposit', target: 500, saved: 500,
      targetDate: '2027-05-01', contribution: 0, gap: 0, required: 0, schedule: [] }] })[0];
    expect(done).toMatchObject({ done: true, needed: 0, onTrack: true, extra: null, finish: null, remaining: 0 });
  });

  // Nothing scheduled before the deadline is not "you need $0" — it is a question we cannot answer.
  it('returns no required amount when no contribution date falls before the deadline', () => {
    const soon = goalMath({ goals: [{ id: 'soon', label: 'Flight', target: 900, saved: 0,
      targetDate: '2026-10-01', contribution: 0, gap: 900, required: null, schedule: [] }] })[0];
    expect(soon.needed).toBeNull();
    expect(soon.extra).toBeNull();
    expect(combinedMath({}, [soon]).needed).toBeNull();
  });
});
