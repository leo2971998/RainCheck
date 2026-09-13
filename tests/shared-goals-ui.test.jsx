import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { household as base } from '../data/household.sample.js';
import { emptyPlan, applyPatch, householdFor, scenarioFor } from '../src/engine/plan.js';
import { fundGoalPatch } from '../src/engine/budget.js';
import { goalPlan, simulate, capacity } from '../src/engine/forecast.js';
import { reviewNotice } from '../src/engine/changes.js';
import GoalsPage from '../src/pages/GoalsPage.jsx';
import BudgetDrawer from '../src/drawers/BudgetDrawer.jsx';
import BillDrawer from '../src/drawers/BillDrawer.jsx';
import NoticeDrawer from '../src/drawers/NoticeDrawer.jsx';
import ForecastPage from '../src/pages/ForecastPage.jsx';
import { monthlyOutlook } from '../src/engine/monthly-outlook.js';

// A supplied notice is a separate input, not something inferred from bank transactions.
const notice = 'From: Northline Internet\nYour internet plan will renew at $90.00 starting with your October 1 bill.';

it('shows combined monthly funding and each goal, with the checking buffer tucked into settings', () => {
  const plan = applyPatch(emptyPlan(), fundGoalPatch(base, emptyPlan(), 'goal-trip',
    { label: 'Trip', target: 500, targetDate: '2027-02-02' }, { monthly: 50, saved: 0, active: true })).plan;
  const h = householdFor(base, plan), sc = scenarioFor(h, plan), goal = goalPlan(h, sc, h.goal);
  const html = renderToStaticMarkup(<GoalsPage base={base} h={h} plan={plan} goal={goal} open={() => {}} />);
  for (const text of ['Your goals', 'Emergency fund', 'Trip', '$350', 'Total monthly saving', 'Edit checking buffer'])
    expect(html.includes(text)).toBe(true);
  expect(html.includes('One goal at a time')).toBe(false);
  expect(html).toMatch(/<details[^>]*><summary>Checking safety buffer<\/summary>/);
  expect(html.includes('Already allocated across goals')).toBe(true);
});

it('asks for an explicit monthly amount and an allocation rather than replacing the active goal', () => {
  const html = renderToStaticMarkup(<BudgetDrawer kind="goal" base={base} plan={emptyPlan()} change={() => {}} onClose={() => {}} />);
  for (const text of ['Monthly saving ($)', 'Already saved for this goal ($)', 'Other goals stay in your plan'])
    expect(html.includes(text)).toBe(true);
  expect(html.includes('Explore one goal at a time')).toBe(false);
});

it('keeps bill previews and forecast assumptions consistent with separate goal contributions', () => {
  const shared = applyPatch(emptyPlan(), fundGoalPatch(base, emptyPlan(), 'goal-trip',
    { label: 'Trip', target: 500, targetDate: '2027-02-02' }, { monthly: 50, saved: 0, active: true })).plan;
  const read = reviewNotice(notice, base.recurring, 2026);
  const bill = read.suggested;
  const record = { ...read.change, increase: read.change.to - bill.amount, noticeText: notice };
  const plan = { ...shared, billChanges: { [bill.id]: record } };
  const h = householdFor(base, plan), sc = scenarioFor(h, plan), cap = capacity(h, sc);
  const billHtml = renderToStaticMarkup(<BillDrawer h={h} plan={plan} notice={notice} billId={bill.id} cap={cap} />);
  const noticeHtml = renderToStaticMarkup(<NoticeDrawer h={h} base={base} plan={plan} cap={cap} initialText={notice} />);
  for (const html of [billHtml, noticeHtml]) {
    expect(html).toContain('Combined goal projection');
    expect(html).toContain('$2,250');
    expect(html).toContain('Goal contributions stay unchanged');
  }
  // Goal savings moved off Forecast: it is a spending page, and every month repeating the goal
  // made the goal look like a monthly cost. The combined figure still has to be subtracted in the
  // bottom line, which is what actually matters for "does this month work".
  const forecast = renderToStaticMarkup(<ForecastPage h={h} sc={sc} plan={plan} sim={simulate(h, sc)} cap={cap} />);
  expect(forecast).not.toContain('goal savings');
  const month = monthlyOutlook(h, sc, '2026-10');
  expect(month.savings).toBe(350);
  expect(forecast).not.toContain('the largest contribution');
});
