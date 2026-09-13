import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { household as base } from '../data/household.sample.js';
import { emptyPlan, householdFor, scenarioFor, applyPatch } from '../src/engine/plan.js';
import { goalPatch } from '../src/engine/budget.js';
import { simulate, goalPlan, capacity } from '../src/engine/forecast.js';
import { buildAlerts } from '../src/engine/alerts.js';
import GoalContext, { PlanConnections } from '../src/components/GoalContext.jsx';
import { createBillReview, billReviewKey } from '../src/engine/bill-reviews.js';

function evaluate(plan, household = base) {
  const h = householdFor(household, plan), sc = scenarioFor(h, plan), sim = simulate(h, sc);
  const goal = goalPlan(h, sc, { ...h.goal, contribution: sc.contribution });
  return { h, sc, sim, goal, alerts: buildAlerts(h, sc, sim, capacity(h, sc), null, goal) };
}
const tripPlan = () => applyPatch(emptyPlan(), goalPatch('goal-trip', {
  label: 'Trip', target: 5000, targetDate: '2027-01-02',
}, 300)).plan;

it('connects goal shortfalls to alerts even when the near-term checking forecast fits', () => {
  const result = evaluate(tripPlan());
  expect(result.goal.gap).toBe(3000);
  expect(result.sim.low.balance).toBe(217.19);
  const alert = result.alerts.find(a => a.id === 'goal');
  expect(alert?.body).toContain('$3,000');
  expect(alert?.actions.some(a => a.target === 'page:goals')).toBe(true);
});

it('uses the current deadline, not the original four-month goal, when reviewing the plan', () => {
  const plan = applyPatch(tripPlan(), { goalDate: '2027-11-02' }).plan;
  const result = evaluate(plan);
  expect(result.goal.schedule).toHaveLength(14);
  expect(result.goal.gap).toBe(0);
  expect(result.goal.fits).toBe(true);
  expect(result.alerts.some(a => a.id === 'goal')).toBe(false);
});

it('rechecks a purchase without silently changing monthly savings', () => {
  const plan = tripPlan(), before = evaluate(plan);
  const baseWithCost = { ...base, plannedPurchases: [{ id: 'concert', label: 'Concert', amount: 50,
    date: '2026-10-15', allowanceId: null, status: 'planned' }] };
  const after = evaluate(plan, baseWithCost);
  expect(after.sim.low.balance).toBe(before.sim.low.balance - 50);
  expect(after.goal.supported).toBeLessThan(before.goal.supported);
  expect(after.goal.contribution).toBe(300);
  expect(after.goal.schedule).toEqual(before.goal.schedule);
  expect(after.alerts.some(a => a.tone === 'bad')).toBe(true);
});

it('connects a reviewed bill spike to forecast affordability and alerts without changing the goal', () => {
  const household = { ...base, cushion: 220 };
  const plan = tripPlan(), before = evaluate(plan, household), bill = household.recurring.find(r => r.id === 'electric');
  const review = createBillReview(bill, { forecastAmount: bill.lastPosted, nextStep: 'contact' });
  const next = applyPatch(plan, { billReviews: { [billReviewKey(bill)]: review } }).plan;
  const after = evaluate(next, household);
  expect(after.sim.low.balance).toBeLessThan(before.sim.low.balance);
  expect(after.goal.supported).toBeLessThan(before.goal.supported);
  expect(after.goal.contribution).toBe(before.goal.contribution);
  expect(after.goal.target).toBe(5000);
  expect(after.alerts.some(a => a.id === 'cushion')).toBe(true);
  expect(after.alerts.some(a => a.id === `unexplained:${bill.id}`)).toBe(false);
});

it('anchors each section to the active goal and explains the current data-processing limits', () => {
  const { h, goal } = evaluate(tripPlan());
  const html = renderToStaticMarkup(<GoalContext page="transactions" h={h} goal={goal} open={() => {}} />);
  for (const text of ['Trip', '$5,000', '$300/month', 'View goal', 'category edits', 'do not change the forecast'])
    expect(html.includes(text)).toBe(true);
  const links = renderToStaticMarkup(<PlanConnections open={() => {}} />);
  for (const label of ['Transactions', 'Recurring', 'Purchases', 'Forecast', 'Alerts']) expect(links.includes(label)).toBe(true);
  expect(links).not.toMatch(/<details[^>]*\bopen/);
});

it('keeps goal status off the recurring payment-history page', () => {
  const { h, goal } = evaluate(tripPlan());
  expect(renderToStaticMarkup(<GoalContext page="recurring" h={h} goal={goal} open={() => {}} />)).toBe('');
});

it('keeps the shared goal banner off the forecast page', () => {
  const { h, goal } = evaluate(tripPlan());
  expect(renderToStaticMarkup(<GoalContext page="forecast" h={h} goal={goal} open={() => {}} />)).toBe('');
});
