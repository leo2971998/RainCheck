// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BudgetDrawer from '../src/drawers/BudgetDrawer.jsx';
import { household as sample } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';

const base = { ...sample, today: '2026-09-13', savings: 800,
  income: [{ date: '2026-09-18', amount: 1800 }],
  goal: { ...sample.goal, label: 'Emergency fund', target: 2000, targetDate: '2026-12-18', planned: 300, saved: 800 } };
let host, root, change, close;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); change = vi.fn(); close = vi.fn(); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
async function render(props = {}) { await act(() => root.render(<BudgetDrawer kind="goal" base={base} plan={emptyPlan()} change={change} onClose={close} {...props} />)); }
async function input(name, value) { const el = host.querySelector(`[name="${name}"]`); await act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true }));
}); }
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent === text);
const click = async text => act(() => button(text).click());

it('suggests monthly savings from the actual contribution dates and keeps allocation optional', async () => {
  await render(); await input('label', 'Trip'); await input('target', '1200');
  expect(host.querySelector('[name="monthly"]').value).toBe('300');
  expect(host.textContent).toContain('4 monthly contributions');
  expect(host.querySelector('[name="saved"]').closest('details').open).toBe(false);
  expect(host.querySelector('[name="saved"]').disabled).toBe(true);
  expect(host.textContent).not.toContain('Already saved for this goal');
  await input('monthly', '150'); await input('target', '1500');
  expect(host.querySelector('[name="monthly"]').value).toBe('150');
  await click('Preview goal'); expect(change).not.toHaveBeenCalled();
  await click('Save goal');
  const patch = change.mock.calls[0][0], newId = Object.keys(patch.goals).find(k => k !== 'emergency-fund');
  expect(patch.goalFunding[newId]).toEqual({ monthly: 150, saved: 0, active: true });
  expect(patch.goalFunding['emergency-fund'].saved).toBe(800);
});

it('saves a name-only edit directly without changing the funding', async () => {
  await render({ id: 'emergency-fund' }); await input('label', 'Rainy day savings');
  await click('Save changes');
  expect(change.mock.calls[0][0].goalFunding['emergency-fund']).toEqual({ monthly: 300, saved: 800, active: true });
  expect(close).toHaveBeenCalledTimes(1);
});

it('requires confirmation for removal and lets the user return without deleting', async () => {
  const plan = { ...emptyPlan(), subscriptions: { 'sub-music': { id: 'sub-music', label: 'Music', amount: 15, startsOn: '2026-09-18', day: 18, everyMonths: 1 } } };
  await render({ kind: 'subscription', id: 'sub-music', plan });
  await click('Remove subscription');
  expect(host.textContent).toContain('Remove Music?'); expect(change).not.toHaveBeenCalled();
  await click('Keep subscription'); expect(change).not.toHaveBeenCalled();
  expect(host.querySelector('[name="label"]').value).toBe('Music');
  await click('Remove subscription'); await click('Remove subscription');
  expect(change.mock.calls[0][0].subscriptions['sub-music']).toBeNull();
});

it('does not apply invalid goal amounts, or silently overwrite an existing monthly choice', async () => {
  await render({ id: 'emergency-fund' });
  await input('target', '700');
  await act(() => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(change).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]').textContent).toContain('goal amount');
  expect(host.querySelector('[name="monthly"]').value).toBe('300');
  await input('target', '3000');
  expect(host.querySelector('[name="monthly"]').value).toBe('300');
});

it('uses the edited payday, rounds a monthly suggestion up to cents, and can be customized', async () => {
  await render({ plan: { ...emptyPlan(), income: [{ date: '2026-10-18', amount: 1800 }] } });
  await input('target', '100');
  expect(host.querySelector('[name="monthly"]').value).toBe('33.34');
  expect(host.textContent).toContain('3 monthly contributions');
  await input('monthly', '20');
  expect(host.querySelector('[name="monthly"]').value).toBe('20');
  await click('Use $33.34/month');
  expect(host.querySelector('[name="monthly"]').value).toBe('33.34');
});
