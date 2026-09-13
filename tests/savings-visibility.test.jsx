// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { household as sample } from '../data/household.sample.js';
import { emptyPlan, applyPatch, householdFor, scenarioFor } from '../src/engine/plan.js';
import { fundGoalPatch } from '../src/engine/budget.js';
import { goalPlan } from '../src/engine/forecast.js';
import SavingsGoals from '../src/components/SavingsGoals.jsx';
import Dashboard from '../src/pages/Dashboard.jsx';

const base = { ...sample, today: '2026-09-13', savings: 800,
  income: [{ date: '2026-09-18', amount: 1800 }],
  goal: { ...sample.goal, label: 'Emergency fund', target: 2000, saved: 800,
    planned: 300, targetDate: '2026-12-18' } };
let host, root, open;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host); open = vi.fn();
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
function context(plan) {
  const h = householdFor(base, plan), sc = scenarioFor(h, plan);
  return { h, sc, goal: goalPlan(h, sc, { ...h.goal, contribution: sc.contribution }) };
}
async function renderSavings(plan = emptyPlan()) {
  const { h, goal } = context(plan);
  await act(() => root.render(<SavingsGoals h={h} base={base} plan={plan} goal={goal} open={open} change={vi.fn()} />));
  return goal;
}
const rows = () => [...host.querySelectorAll('.goal-row:not(.goal-row-head)')];

it.each([300, 125])('shows the original emergency fund without changing its $%s monthly plan', async monthly => {
  const plan = { ...emptyPlan(), contribution: monthly };
  const before = JSON.stringify({ base, plan });
  const goal = await renderSavings(plan);
  expect(goal.goals).toBeUndefined(); // Exercise the original single-goal calculator, not a replacement.
  expect(rows()).toHaveLength(1);
  expect(rows()[0].querySelector('.goal-row-name').textContent).toBe('Emergency fundTarget $2,000');
  expect(rows()[0].querySelector('progress').value).toBe(800);
  expect(rows()[0].querySelector('.goal-row-saved').textContent).toBe('$800');
  expect(rows()[0].querySelector('.goal-row-need').textContent).toBe('$300/mo');
  expect(goal.contribution).toBe(monthly);
  expect(rows()[0].querySelector('button').textContent).toBe('Edit');
  expect(host.textContent).not.toContain('No goals are receiving contributions');
  expect(JSON.stringify({ base, plan })).toBe(before);
});

it('still shows the emergency fund when an edit is undone back to the original plan', async () => {
  await renderSavings({ ...emptyPlan(), contribution: 125 });
  await renderSavings(emptyPlan());
  expect(rows()).toHaveLength(1);
  expect(rows()[0].querySelector('.goal-row-need').textContent).toBe('$300/mo');
  await act(() => rows()[0].querySelector('button').click());
  expect(open).toHaveBeenCalledWith('goal', 'emergency-fund');
});

it('keeps a legacy selected goal identity and opens the right edit form', async () => {
  const plan = { ...emptyPlan(), goalId: 'trip', goals: {
    trip: { label: 'Family trip', target: 2000, targetDate: '2026-12-18' },
  } };
  await renderSavings(plan);
  expect(rows()[0].textContent).toContain('Family trip');
  await act(() => rows()[0].querySelector('button').click());
  expect(open).toHaveBeenCalledWith('goal', 'trip');
});

it('keeps both goals visible after moving to a shared savings plan', async () => {
  const plan = applyPatch(emptyPlan(), fundGoalPatch(base, emptyPlan(), 'trip',
    { label: 'Family trip', target: 500, targetDate: '2027-02-18' },
    { monthly: 100, saved: 0, active: true })).plan;
  await renderSavings(plan);
  expect(rows()).toHaveLength(2);
  expect(rows().map(row => row.querySelector('.goal-row-name b').textContent)).toEqual(['Emergency fund', 'Family trip']);
  expect(rows().map(row => row.querySelector('.goal-row-need').textContent)).toEqual(['$300/mo', '$83.34/mo']);
  expect(rows().map(row => row.querySelector('.goal-row-saved').textContent)).toEqual(['$800', '$0']);
});

it('does not reactivate a paused fund or claim an empty plan is on track', async () => {
  const plan = { ...emptyPlan(), goalFunding: {
    'emergency-fund': { monthly: 300, saved: 800, active: false },
  } };
  const before = JSON.stringify(plan);
  await renderSavings(plan);
  expect(rows()).toHaveLength(0);
  expect(host.textContent).toContain('No active goals');
  expect(host.textContent).not.toContain('On track');
  expect(host.querySelector('.goal-paused').textContent).toContain('Emergency fundpaused');
  expect(host.querySelector('.goal-path')).toBeNull();
  expect(JSON.stringify(plan)).toBe(before);
});

it('shows no monthly amount rather than infinity for a legacy deadline with no future dates', async () => {
  await renderSavings({ ...emptyPlan(), goalDate: '2026-09-12' });
  expect(rows()).toHaveLength(1);
  expect(rows()[0].querySelector('.goal-row-need').textContent).toBe('—');
  expect(rows()[0].textContent).toContain('Choose a later deadline');
  expect(host.textContent).not.toMatch(/Infinity|NaN|∞/);
});

it('shows only the five savings fields and edit actions, without the extra planning panels', async () => {
  await renderSavings();
  expect([...host.querySelectorAll('.goal-row-head > span')].map(el => el.textContent))
    .toEqual(['Goal', 'Progress', 'Deadline', 'Saved', 'Needs / month', '']);
  for (const text of ['Savings plan details', 'Recorded balance', 'Allocated across goals', 'Not assigned to a goal',
    'Edit checking buffer', 'Practice a savings transfer', 'What that costs, month by month', 'your plan, a month', 'to make every date']) {
    expect(host.textContent).not.toContain(text);
  }
  expect(host.querySelector('.goal-summary, .goal-path, .goal-extras')).toBeNull();
  const add = [...host.querySelectorAll('button')].find(el => el.textContent === 'Add a goal');
  await act(() => add.click());
  expect(open).toHaveBeenCalledWith('goal');
});

it('keeps completed goals editable', async () => {
  await renderSavings({ ...emptyPlan(), goalTarget: 800 });
  expect(rows()[0].querySelector('.goal-row-saved').textContent).toBe('$800');
  expect(rows()[0].querySelector('.goal-row-need').textContent).toBe('$0/mo');
  expect(rows()[0].textContent).toContain('Fully saved');
  await act(() => rows()[0].querySelector('button').click());
  expect(open).toHaveBeenCalledWith('goal', 'emergency-fund');
});

it('links the homepage savings summary to Spending & Savings while retaining the emergency fund', async () => {
  const { h, sc } = context(emptyPlan());
  await act(() => root.render(<Dashboard h={h} sc={sc} open={open} />));
  const widget = [...host.querySelectorAll('.today-widget')].find(el => el.textContent.includes('Emergency fund'));
  expect(widget.textContent).toContain('Savings');
  expect(widget.textContent).toContain('$800');
  expect(widget.textContent).toContain('Spending & Savings');
  expect(widget.textContent).not.toContain('View goals');
  expect(widget.textContent).not.toContain('Your goals');
  await act(() => widget.click());
  expect(open).toHaveBeenCalledWith('page:cashflow');
});
