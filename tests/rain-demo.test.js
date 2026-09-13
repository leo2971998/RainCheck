import { expect, it } from 'vitest';
import { household as base } from '../data/household.sample.js';
import { emptyPlan, applyPatch, householdFor, scenarioFor } from '../src/engine/plan.js';
import { simulate } from '../src/engine/forecast.js';
import { rainDemoPatch, RAIN_DEMO_ID } from '../src/engine/rain-demo.js';
import { subscriptionPatch } from '../src/engine/budget.js';
import { weeklyBudget } from '../src/engine/weekly-budget.js';

it('adds a labeled test cost that produces rain through the real calculator', () => {
  const plan = emptyPlan(), h = householdFor(base, plan), sc = scenarioFor(h, plan);
  const before = JSON.stringify({ base, plan });
  const patch = rainDemoPatch(base, plan);
  expect(patch.subscriptions[RAIN_DEMO_ID].amount).toBe(25);
  expect(patch.subscriptions[RAIN_DEMO_ID].label).toContain('Local rain test');
  const next = applyPatch(plan, patch).plan, nextH = householdFor(base, next);
  const sim = simulate(nextH, scenarioFor(nextH, next));
  expect(sim.worst).toBe('below');
  expect(sim.low.balance).toBe(175);
  expect(JSON.stringify({ base, plan })).toBe(before);
  expect(next.cushion).toBe(plan.cushion);
});
it('removes only the demo cost and preserves other saved choices', () => {
  const plan = { ...emptyPlan(), contribution: 250 };
  const next = applyPatch(plan, rainDemoPatch(base, plan)).plan;
  const ended = applyPatch(next, subscriptionPatch(RAIN_DEMO_ID, null)).plan;
  const h = householdFor(base, ended);
  expect(ended.contribution).toBe(250);
  expect(simulate(h, scenarioFor(h, ended)).low.balance).toBe(250);
});
it('does not overwrite a demo or pretend rain is possible with a zero target', () => {
  const plan = emptyPlan();
  const demo = applyPatch(plan, rainDemoPatch(base, plan)).plan;
  expect(() => rainDemoPatch(base, demo)).toThrow();
  expect(() => rainDemoPatch(base, { ...plan, cushion: 0 })).toThrow();
  expect(() => rainDemoPatch(base, { ...plan, cushion: 350 })).toThrow();
});

it('can demonstrate a $25 shortfall in this week, instead of a later forecast week', () => {
  const plan = emptyPlan();
  const patch = rainDemoPatch(base, plan, 'week');
  expect(patch.subscriptions[RAIN_DEMO_ID].startsOn).toBe(base.today);
  const next = applyPatch(plan, patch).plan, h = householdFor(base, next);
  expect(weeklyBudget(h, scenarioFor(h, next))).toMatchObject({ state: 'below', shortfall: 25 });
  const ended = applyPatch(next, subscriptionPatch(RAIN_DEMO_ID, null)).plan;
  const original = householdFor(base, ended);
  expect(weeklyBudget(original, scenarioFor(original, ended)).state).toBe('ok');
});
