import { expect, it } from 'vitest';
import { household as base } from '../data/household.sample.js';
import { emptyPlan, applyPatch, revert, householdFor, scenarioFor, readCheckingTarget } from '../src/engine/plan.js';
import { simulate, capacity } from '../src/engine/forecast.js';
import { buildOptions } from '../src/engine/options.js';
import { budgetImpact } from '../src/engine/budget.js';
import { readReviewPlan, householdVersion, calculateReview, reviewBrief } from '../api/_review.js';
import { calculateChat } from '../api/_chat.js';

it('validates a checking target including zero and cents', () => {
  expect(readCheckingTarget('0')).toBe(0);
  expect(readCheckingTarget('275.50')).toBe(275.5);
  for (const value of ['', '-1', '1.001', '1000001', 'NaN', 'Infinity', '1e3'])
    expect(() => readCheckingTarget(value)).toThrow();
});
it('changes only the threshold, persists as a decision, and supports Undo', () => {
  const original = emptyPlan();
  const { plan, entry } = applyPatch(original, { cushion: 350 });
  const restored = JSON.parse(JSON.stringify({ plan, entry }));
  const h = householdFor(base, restored.plan);
  expect(h.cushion).toBe(350);
  expect(h.checking).toBe(base.checking);
  expect(h.savings).toBe(base.savings);
  const before = simulate(base, scenarioFor(base, original));
  const after = simulate(h, scenarioFor(h, restored.plan));
  expect(after.days.map(d => d.balance)).toEqual(before.days.map(d => d.balance));
  expect(after.worst).toBe('below');
  expect(householdFor(base, revert(restored.plan, restored.entry)).cushion).toBe(base.cushion);
  expect(base.cushion).toBe(200);
  expect(householdFor(base, {}).cushion).toBe(200);
  expect(householdFor(base, { ...original, cushion: 0 }).cushion).toBe(0);
});
it('keeps the website, chat, and AI review on the edited target', () => {
  const plan = { ...emptyPlan(), cushion: 350 };
  const impact = budgetImpact(base, plan, {});
  expect(impact.cushion).toBe(350);
  expect(impact.after.state).toBe('below');
  expect(readReviewPlan(plan, base).cushion).toBe(350);
  const body = { consent: true, baseVersion: householdVersion(base), plan };
  expect(calculateChat(base, { ...body, tool: 'get_current_plan', args: {} }).impact).toEqual(impact);
  const reviewBody = { ...body, patch: {}, kind: 'plan', question: 'What should I check?' };
  expect(reviewBrief(calculateReview(base, reviewBody), reviewBody, []).cushionCents).toBe(35000);
  for (const cushion of [-1, Infinity, 1000001, 0.001, '350'])
    expect(() => readReviewPlan({ ...plan, cushion }, base)).toThrow();
});
it('can resolve rain by an explicit savings adjustment without lowering the target', () => {
  const plan = { ...emptyPlan(), cushion: 350 };
  const h = householdFor(base, plan), sc = scenarioFor(h, plan);
  const before = simulate(h, sc);
  const option = buildOptions(h, sc, capacity(h, sc), { groceries: true }).find(o => o.id === 'keep');
  expect(before.worst).toBe('below');
  expect(option.outcome.meetsCushion).toBe(true);
  const next = applyPatch(plan, option.apply).plan;
  const after = simulate(householdFor(base, next), scenarioFor(h, next));
  expect(after.low.balance).toBeGreaterThanOrEqual(350);
  expect(next.cushion).toBe(350);
  expect(h.checking).toBe(base.checking);
  expect(simulate(h, sc).low.balance).toBe(before.low.balance);
});
it('does not clear a negative forecast by lowering the warning target to zero', () => {
  const plan = { ...emptyPlan(), cushion: 0, contribution: 550 };
  const h = householdFor(base, plan);
  expect(simulate(h, scenarioFor(h, plan)).worst).toBe('over');
});
it('keeps both targets explicit when AI reviews a target-change preview', () => {
  const body = { consent: true, baseVersion: householdVersion(base), plan: emptyPlan(),
    patch: { cushion: 350.50 }, kind: 'plan', question: 'What changes?' };
  const impact = calculateReview(base, body);
  expect(impact).toEqual(budgetImpact(base, emptyPlan(), body.patch));
  const brief = reviewBrief(impact, body, []);
  expect(brief.before.cushionCents).toBe(20000);
  expect(brief.after.cushionCents).toBe(35050);
  expect(brief.after.lowCents).toBe(brief.before.lowCents);
});
