// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PurchaseDrawer from '../src/drawers/PurchaseDrawer.jsx';
import { household as sample } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';

const purchase = { id: 'tickets', revision: 1, label: 'Concert tickets', date: '2026-10-12', amount: 100, status: 'planned', accountId: sample.checkingId };
const base = { ...sample, plannedPurchases: [purchase] };
let host, root, refresh, close, fetcher;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  refresh = vi.fn().mockResolvedValue(true); close = vi.fn();
  fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }); vi.stubGlobal('fetch', fetcher);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render() { await act(() => root.render(<PurchaseDrawer id="tickets" base={base} baseVersion="version" plan={emptyPlan()} refresh={refresh} onClose={close} />)); }
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent === text);
const click = async text => act(async () => { button(text).click(); });
const writes = () => fetcher.mock.calls.filter(([url, options]) => url === '/api/purchases' && ['POST', 'PUT', 'DELETE'].includes(options?.method));

it('uses a short, named removal confirmation without an AI or purchase-planning walkthrough', async () => {
  await render(); await click('Remove planned purchase');
  expect(host.textContent).toContain('Remove Concert tickets?');
  expect(host.textContent).not.toContain('Review the plan with AI');
  expect(host.textContent).not.toContain('Step 2');
  expect(fetcher).not.toHaveBeenCalled();
  await click('Keep purchase'); expect(fetcher).not.toHaveBeenCalled();
  expect(host.querySelector('[name="label"]').value).toBe('Concert tickets');
  await click('Remove planned purchase'); await click('Remove purchase');
  expect(fetcher.mock.calls[0][1].method).toBe('DELETE');
  expect(JSON.parse(fetcher.mock.calls[0][1].body).id).toBe('tickets');
  expect(close).toHaveBeenCalledTimes(1);
});

it('does not submit again when saving succeeded but reloading the updated household failed', async () => {
  refresh.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await render(); await click('Preview impact'); await click('Save purchase');
  expect(writes()).toHaveLength(1);
  expect(host.textContent).toContain('Your purchase was saved');
  expect(button('Save purchase').disabled).toBe(true);
  await click('Save purchase'); expect(writes()).toHaveLength(1);
  await click('Reload purchases');
  expect(writes()).toHaveLength(1);
  expect(close).toHaveBeenCalledTimes(1);
});

it('preserves a purchase draft when closing is cancelled', async () => {
  await render();
  const el = host.querySelector('[name="label"]');
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Family concert');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(() => host.querySelector('[aria-label="Close"]').click());
  expect(host.textContent).toContain('Discard unsaved changes?');
  await click('Keep editing');
  expect(el.value).toBe('Family concert'); expect(close).not.toHaveBeenCalled();
});
