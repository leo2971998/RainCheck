import { expect, it, vi } from 'vitest';
import { requestOptimization } from '../src/hooks/useBudgetOptimization.js';

const input = { baseVersion: 'version', plan: { cuts: {} }, protectedIds: { groceries: true, dining: false } };
const done = { review: { status: 'complete', result: { summary: 'Keep essential spending intact.' } }, optimization: { draft: { targets: { groceries: 500 }, extras: {} } } };
it('requests analysis first without sending edited targets or a raw transaction list', async () => {
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => done }));
  expect(await requestOptimization(input, { fetcher })).toEqual(done);
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body).toMatchObject({ optimize: true, focus: 'spending', consent: true, protectedCategories: ['groceries'], patch: {} });
  expect(body).not.toHaveProperty('targets');
  expect(body).not.toHaveProperty('transactions');
});
it('rejects an incomplete AI result even if editable targets were returned', async () => {
  for (const data of [{ ...done, review: { status: 'unavailable' } }, { ...done, optimization: null }]) {
    await expect(requestOptimization(input, { fetcher: async () => ({ ok: true, json: async () => data }) })).rejects.toThrow('could not finish');
  }
});
it('passes cancellation through and never exposes raw server errors', async () => {
  const controller = new AbortController(); controller.abort();
  const fetcher = vi.fn(async (_url, { signal }) => { signal.throwIfAborted(); });
  await expect(requestOptimization(input, { signal: controller.signal, fetcher })).rejects.toThrow();
  await expect(requestOptimization(input, { fetcher: async () => ({ ok: false, status: 500, json: async () => ({ message: 'SECRET TRACE' }) }) })).rejects.toThrow('could not finish');
});
it('requires reloading when bank records change before analysis', async () => {
  await expect(requestOptimization(input, { fetcher: async () => ({ ok: false, status: 409 }) })).rejects.toThrow('Reload');
  await expect(requestOptimization({ ...input, baseVersion: null })).rejects.toThrow('Reload');
});
