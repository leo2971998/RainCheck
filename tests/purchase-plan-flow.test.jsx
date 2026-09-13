// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PurchaseDrawer from '../src/drawers/PurchaseDrawer.jsx';
import { purchaseImpact } from '../src/engine/purchase-impact.js';
import { emptyPlan } from '../src/engine/plan.js';
const trip = { id: 'trip', revision: 1, status: 'planned', label: 'Family trip', amount: 1200,
  date: '2026-09-14', accountId: 'checking', allowanceId: null };
const base = { today: '2026-09-13', checking: 515, savings: 800, cushion: 200, windowDays: 34,
  checkingId: 'checking', spendingPeriod: 'calendar-month', recurring: [], allowances: [], plannedPurchases: [trip],
  income: [{ date: '2026-09-18', amount: 1800 }, { date: '2026-10-02', amount: 1800 }],
  goal: { label: 'Emergency fund', target: 2000, saved: 800, planned: 300, targetDate: '2026-12-18' } };
const plan = emptyPlan();
let host, root, requests;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  requests = []; vi.stubGlobal('fetch', vi.fn((url, options) => new Promise(resolve => requests.push({ url, options, resolve }))));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const button = name => [...host.querySelectorAll('button')].find(b => b.textContent === name);
async function open() {
  await act(() => root.render(<PurchaseDrawer id="trip" base={base} baseVersion="v1" plan={plan} refresh={async () => true} onClose={() => {}} />));
  await act(() => button('Analyze purchase').click());
}
async function finish(status = 'complete') {
  const request = requests.at(-1), input = JSON.parse(request.options.body);
  await act(() => request.resolve({ ok: true, json: async () => ({ impact: purchaseImpact(base, plan, input.patch),
    review: { status, result: status === 'complete' ? { summary: 'Wait until payday to keep the trip budget and current savings plan.',
      observations: [{ text: 'The later date avoids the early cash gap without reducing goal contributions.', facts: ['evidence.1'] }] } : null } }) }));
}
it('waits for AI before revealing the purchase impact and save action', async () => {
  await open();
  expect(host.textContent).toContain('Analyzing your purchase');
  expect(host.querySelector('[aria-label="Purchase funding check"]')).toBeNull();
  expect(button('Save purchase')).toBeUndefined();
  expect(requests).toHaveLength(1);
  await finish();
  expect(host.textContent).toContain('Wait until payday');
  expect(host.textContent).toContain('The later date avoids the early cash gap');
  expect(host.querySelector('[aria-label="Purchase AI review"] details').open).toBe(false);
  expect(host.querySelector('[aria-label="Purchase funding check"]')).not.toBeNull();
  expect(button('Save purchase')).toBeDefined();
  expect(requests.every(r => r.url === '/api/review')).toBe(true);
});
it('does not show an unreviewed plan or save button when analysis fails', async () => {
  await open(); await finish('unavailable');
  expect(host.textContent).toContain('Analysis could not finish');
  expect(host.querySelector('[aria-label="Purchase funding check"]')).toBeNull();
  expect(button('Save purchase')).toBeUndefined();
  await act(() => button('Retry analysis').click()); await finish();
  expect(button('Save purchase')).toBeDefined();
});

it('rechecks a suggested date before it can be saved and keeps savings unchanged', async () => {
  await open(); await finish();
  expect(host.textContent).toContain('Suggested plan');
  await act(() => button('Review this date').click());
  expect(host.textContent).toContain('Analyzing your purchase');
  expect(host.querySelector('[aria-label="Purchase funding check"]')).toBeNull();
  expect(button('Save purchase')).toBeUndefined();
  const request = JSON.parse(requests.at(-1).options.body);
  expect(request.patch.draft).toMatchObject({ amount: 1200, date: '2026-09-18' });
  expect(request.plan).toEqual(plan);
  await finish();
  expect(host.textContent).toContain('This purchase fits the checking budget');
  expect(host.textContent).toContain('$300/month');
  expect(requests.every(r => r.url === '/api/review')).toBe(true);
});
