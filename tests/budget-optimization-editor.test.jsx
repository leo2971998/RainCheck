// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SavingsPlanner from '../src/drawers/SavingsPlanner.jsx';
import { household as sample } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';

const base = { ...sample, today: '2026-09-13', checking: 10000, recurring: [],
  allowances: [{ id: 'groceries', label: 'Groceries', monthly: 300 },
    { id: 'dining', label: 'Dining', monthly: 200 }, { id: 'transit', label: 'Transit', monthly: 100 }],
  income: [{ date: '2026-09-18', amount: 1800 }],
  goal: { ...sample.goal, targetDate: '2026-12-18' } };
const makeResult = (targets = {}) => ({ status: 'ready', data: {
  review: { status: 'complete', result: { summary: 'Try a smaller dining budget.',
    observations: [{ text: 'Household has already run above its usual monthly limit.' }],
    questions: ['Could replacement costs erase these savings?'] } },
  optimization: { draft: { targets: { groceries: 300, dining: 180, transit: 100, ...targets }, extras: {} } },
} });
let root, host, change, close, plan, protectedIds;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  change = vi.fn(); close = vi.fn(); plan = emptyPlan(); protectedIds = { groceries: true };
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
async function render(optimization = makeResult(), overrides = {}) {
  await act(() => root.render(<SavingsPlanner base={base} baseVersion="test-household" plan={plan}
    protectedIds={protectedIds} optimization={optimization} change={change} onClose={close} {...overrides} />));
}
const input = id => host.querySelector(`#saving-${id}`);
const confirm = () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Confirm budget & savings changes');
const click = el => act(() => el.click());
async function edit(id, value) {
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input(id), value);
    input(id).dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it('lets the user edit every amount after AI finishes, including a protected category', async () => {
  await render();
  for (const el of host.querySelectorAll('[id^="saving-"]')) {
    expect(el.readOnly).toBe(false); expect(el.disabled).toBe(false);
  }
  expect(input('groceries').closest('.limit-row').textContent).toContain('unchanged by AI');
  expect(host.textContent).not.toContain('Preview changes');
});

it('previews an explicit protected-category edit and saves only after confirmation', async () => {
  const before = JSON.stringify({ base, plan, protectedIds });
  await render(); await edit('groceries', '275');
  expect(input('groceries').closest('.limit-row').textContent).toContain('edited by you');
  expect(host.querySelector('.optimization-headline b').textContent).toBe('$45');
  expect(input('groceries').closest('.limit-row').querySelector('.limit-freed').textContent).toBe('$25');
  expect(change).not.toHaveBeenCalled();
  expect(confirm().disabled).toBe(false);
  await click(confirm());
  expect(change).toHaveBeenCalledTimes(1);
  expect(change.mock.calls[0][0]).toEqual({ cuts: { groceries: 25, dining: 20 } });
  expect(close).toHaveBeenCalledTimes(1);
  expect(JSON.stringify({ base, plan, protectedIds })).toBe(before);
});

it('does not unlock other protected amounts just because the user edited one category', async () => {
  await render(makeResult({ groceries: 250 }));
  await edit('dining', '170');
  expect(host.textContent).toContain('Groceries is protected');
  expect(confirm()?.disabled ?? true).toBe(true);
  expect(change).not.toHaveBeenCalled();
  // Only explicitly editing groceries overrides that category's protection for this proposal.
  await edit('groceries', '280');
  expect(confirm().disabled).toBe(false);
  await click(confirm());
  expect(change.mock.calls[0][0]).toEqual({ cuts: { groceries: 20, dining: 30 } });
  expect(protectedIds).toEqual({ groceries: true });
});

it.each(['', '-1', '301', '275.001'])('disables confirmation for invalid amount %j and resumes with the latest valid calculation', async invalid => {
  await render(); await edit('groceries', '275');
  expect(confirm().disabled).toBe(false);
  await edit('groceries', invalid);
  expect(confirm().disabled).toBe(true);
  await click(confirm()); expect(change).not.toHaveBeenCalled();
  expect(host.querySelector('.optimization-headline').textContent).not.toContain('Fits your forecast');
  await edit('groceries', '290');
  expect(host.querySelector('.optimization-headline b').textContent).toBe('$30');
  expect(confirm().disabled).toBe(false);
  await click(confirm());
  expect(change.mock.calls[0][0]).toEqual({ cuts: { groceries: 10, dining: 20 } });
});

it('keeps the short explanation but removes the full review, questions and source footer', async () => {
  await render();
  expect(host.textContent).toContain('Try a smaller dining budget.');
  for (const text of ['Why these limits', 'Household has already run above', 'Could replacement costs', 'Written by the cloud review'])
    expect(host.textContent).not.toContain(text);
  expect(host.querySelector('.optimization-review')).toBeNull();
});

it('keeps the unsaved-edit protection when closing the updated editor', async () => {
  await render(); await edit('groceries', '275');
  await click(host.querySelector('[aria-label="Close"]'));
  expect(close).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Discard unsaved changes?');
  await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Keep editing'));
  expect(input('groceries').value).toBe('275');
  expect(confirm().disabled).toBe(false);
});

it('does not call a still-short forecast good just because a spending reduction can be saved', async () => {
  await render(makeResult(), { base: { ...base, checking: 0 } });
  expect(host.querySelector('.optimization-headline').textContent).toContain('Forecast still runs short');
  expect(host.querySelector('.optimization-headline').textContent).not.toContain('Fits your forecast');
  expect(confirm().disabled).toBe(false); // A partial improvement is allowed, not described as a full repair.
});

it('keeps category protection on the next optimization instead of carrying a manual override forward', async () => {
  await render(); await edit('groceries', '275');
  await act(() => root.render(null));
  await render(makeResult({ groceries: 250 }));
  expect(host.textContent).toContain('Groceries is protected');
  expect(confirm()?.disabled ?? true).toBe(true);
  expect(change).not.toHaveBeenCalled();
  expect(protectedIds).toEqual({ groceries: true });
});

it('explains an overspent category separately from goal funding and future reductions', async () => {
  const h = { ...base, goal: { ...base.goal, target: 2000, saved: 800, planned: 300 },
    allowances: [...base.allowances, { id: 'household', label: 'Household', monthly: 176 }],
    spendingEvidence: { asOf: base.today, months: ['2026-09'], categories: [
      { id: 'household', months: [{ key: '2026-09', spent: 836, total: 836 }] },
    ] } };
  await render(makeResult({ household: 176 }), { base: h });
  const problem = host.querySelector('[aria-label="Spending to review"]');
  expect(problem.textContent).toContain('Household');
  expect(problem.textContent).toContain('$660 over');
  expect(problem.textContent).toContain('$836 spent');
  expect(problem.textContent).toContain('already spent');
  expect(host.textContent).toContain('$300/month needed');
  expect(host.textContent).toContain('$300/month planned');
  expect(host.textContent).toContain('No extra monthly saving needed');
  expect(host.textContent).toContain('4 monthly payments');
  expect(host.textContent).toContain('less spending for the rest of September');
});

it('shows the unfilled goal gap rather than calling a budget-only cut a completed savings plan', async () => {
  plan = { ...emptyPlan(), contribution: 250 };
  await render(makeResult(), { base: { ...base, goal: { ...base.goal, target: 2000, saved: 800, planned: 300 } } });
  expect(host.textContent).toContain('$50/month more');
  expect(host.textContent).toContain('$30/month still needs another source');
  expect(host.textContent).toContain('Still $50/month to assign');
  expect(host.querySelector('.optimization-headline').textContent).not.toContain('Fits your forecast');
});

it('shows a dated remaining cash shortage instead of promising the overspend was fixed', async () => {
  await render(makeResult(), { base: { ...base, checking: 0 } });
  const result = host.querySelector('[aria-label="Savings plan preview"]');
  expect(result.textContent).toContain('These cuts are not enough');
  expect(result.textContent).toContain('below the amount you keep in checking');
  expect(result.textContent).toContain('Review upcoming purchases or change a goal’s amount or date');
});

it('shows recovery as unresolved even if the goal fits and lets the user choose a later date', async () => {
  const result = makeResult();
  result.data.optimization.draft.recovery = { amount: 660, deadline: '2026-12-18' };
  await render(result);
  expect(host.querySelector('.optimization-headline').textContent).toContain('Recovery still short');
  const recovery = host.querySelector('[aria-label="Recovery objective"]');
  expect(recovery.textContent).toContain('Still to recover');
  expect(recovery.textContent).toContain('Your existing goal contributions stay in the plan');
  expect(change).not.toHaveBeenCalled();
  const date = host.querySelector('[aria-label="Recovery deadline"]');
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(date, '2026-09-01');
    date.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(confirm().disabled).toBe(true);
  expect(host.textContent).toContain('Choose a recovery date');
});
