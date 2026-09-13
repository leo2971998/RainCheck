// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import PurchaseReview from '../src/components/PurchaseReview.jsx';
let root, host;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
afterEach(async () => { await act(() => root?.unmount()); host?.remove(); vi.unstubAllGlobals(); });
it('automatically requests a read-only purchase review and displays only the returned explanation', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ review: { status: 'complete',
    result: { summary: 'The purchase creates a cash gap before payday.' } } }) });
  vi.stubGlobal('fetch', fetcher);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  const status = vi.fn(), patch = { draft: { amount: 1200 } }, plan = {};
  await act(() => root.render(<StrictMode><PurchaseReview baseVersion="version" patch={patch} plan={plan} onStatus={status} /></StrictMode>));
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe('/api/review');
  expect(JSON.parse(options.body)).toMatchObject({ consent: true, kind: 'purchase', patch, plan, baseVersion: 'version' });
  expect(host.textContent).toContain('The purchase creates a cash gap before payday.');
  expect(status).toHaveBeenLastCalledWith('ready');
  expect(host.textContent).not.toContain('Allow cloud review');
});

it('keeps an incomplete review explicit and allows a read-only retry', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ review: { status: 'unavailable' } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ review: { status: 'complete',
      result: { summary: 'A smaller purchase would leave room for the current savings plan.' } } }) });
  vi.stubGlobal('fetch', fetcher);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  const status = vi.fn();
  await act(() => root.render(<PurchaseReview baseVersion="version" patch={{ draft: { amount: 100 } }} plan={{}} onStatus={status} />));
  expect(host.textContent).toContain('AI could not finish');
  expect(status).toHaveBeenLastCalledWith('error');
  await act(() => host.querySelector('button').click());
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(([url]) => url === '/api/review')).toBe(true);
  expect(host.textContent).toContain('A smaller purchase would leave room');
  expect(status).toHaveBeenLastCalledWith('ready');
});
