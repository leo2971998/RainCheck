import { expect, it, vi } from 'vitest';
import { createPurchaseHandler } from '../api/purchases.js';
import { createHouseholdHandler } from '../api/household.js';
import { createContextHandler } from '../api/chat-context.js';
import { householdVersion } from '../api/_review.js';
import { localReviewAllowed } from '../api/_local-workspace.js';
import { household } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';

const origin = 'https://raincheck-planner.vercel.app';
const env = { VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production',
  RAINCHECK_SHARED_DEMO: '1', RAINCHECK_DEMO_ORIGIN: origin,
  RAINCHECK_PUBLIC_CHAT: '1', RAINCHECK_CHAT_ORIGIN: origin,
  RAINCHECK_CHAT_RATE_SECRET: 'test-only-rate-secret-with-32-characters',
  SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_SECRET_KEY: 'test-db-key',
  NESSIE_KEY: 'test-bank-key', NESSIE_CUSTOMER_ID: 'customer', NESSIE_CHECKING_ID: 'checking', NESSIE_SAVINGS_ID: 'savings' };
const base = { ...household, checkingId: 'checking', plannedPurchases: [] };
const id = '24e08bab-b1ca-4698-b1b5-2633e5017207';
const draft = { label: 'Shared demo tickets', merchant: 'Ticket shop', amount: 25, date: base.today, accountId: 'checking', allowanceId: null };
const req = (method = 'GET', body) => ({ method, body, query: {}, socket: { remoteAddress: '10.0.0.1' },
  headers: { host: 'raincheck-planner.vercel.app', origin, 'content-type': 'application/json', 'x-vercel-forwarded-for': '203.0.113.7' } });
const res = () => ({ statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
  status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
const allowed = async () => ({ allowed: true, retryAfter: 0 });

it('shares create, read, edit and cancel between hosted and local purchase handlers', async () => {
  let purchases = [];
  const current = () => ({ ...base, plannedPurchases: purchases });
  const load = vi.fn(async () => ({ base: current(), snapshot: {} }));
  const save = vi.fn(async (id, revision, record) => {
    const saved = { ...record, id, revision: revision + 1 };
    purchases = [...purchases.filter(p => p.id !== id), saved]; return saved;
  });
  const publicHandler = createPurchaseHandler({ env, load, save, limit: allowed });
  const localHandler = createPurchaseHandler({ env: { RAINCHECK_AI_LOCAL: '1' }, load, save });
  const localReq = (method, body) => ({ method, body, query: {}, socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '127.0.0.1:5176', origin: 'http://127.0.0.1:5176', 'content-type': 'application/json' } });
  const payload = revision => ({ id, revision, baseVersion: householdVersion(current()), draft });
  const created = res(); await publicHandler(req('POST', payload(0)), created);
  expect(created.statusCode).toBe(200);
  expect(load).toHaveBeenCalledWith({ live: true });
  const localRead = res(); await localHandler(localReq('GET'), localRead);
  expect(localRead.body.purchases[0]).toMatchObject({ id, amount: 25, revision: 1 });
  const changed = res(); await localHandler(localReq('PUT', { ...payload(1), draft: { ...draft, amount: 35 } }), changed);
  expect(changed.statusCode).toBe(200);
  const publicRead = res(); await publicHandler(req(), publicRead);
  expect(publicRead.body.purchases[0]).toMatchObject({ amount: 35, revision: 2 });
  const cancelled = res(); await publicHandler(req('DELETE', payload(2)), cancelled);
  expect(cancelled.statusCode).toBe(200);
  expect(purchases[0]).toMatchObject({ status: 'cancelled', revision: 3 });
});

it('keeps shared access opt-in, production-only and on the configured origin', async () => {
  const load = vi.fn(), save = vi.fn(), limit = vi.fn(allowed);
  for (const [config, input] of [
    [{ ...env, RAINCHECK_SHARED_DEMO: '0' }, req()],
    [{ ...env, VERCEL_ENV: 'preview' }, req()],
    [{ ...env, NESSIE_CHECKING_ID: '' }, req()],
    [{ ...env, SUPABASE_SECRET_KEY: '' }, req()],
    [{ ...env, RAINCHECK_CHAT_RATE_SECRET: '' }, req()],
    [env, { ...req(), headers: { ...req().headers, host: 'other.vercel.app' } }],
    [env, { ...req('POST', {}), headers: { ...req().headers, origin: 'https://evil.example' } }],
    [env, { ...req('POST', {}), headers: { ...req().headers, origin: undefined } }],
    [env, { ...req('POST', {}), headers: { ...req().headers, 'content-type': 'text/plain' } }],
    [env, { ...req(), headers: { ...req().headers, 'sec-fetch-site': 'cross-site' } }],
  ]) {
    const out = res(); await createPurchaseHandler({ env: config, load, save, limit })(input, out);
    expect(out.statusCode).toBe(403);
  }
  expect(load).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); expect(limit).not.toHaveBeenCalled();
  expect(localReviewAllowed(req(), { ...env, RAINCHECK_AI_LOCAL: '1' })).toBe(false);
});

it('enforces write quotas and fails closed before reading or saving when the quota is unavailable', async () => {
  const load = vi.fn(), save = vi.fn();
  const body = { id, revision: 0, baseVersion: householdVersion(base), draft };
  const limited = res();
  await createPurchaseHandler({ env, load, save, limit: async () => ({ allowed: false, retryAfter: 60 }) })(req('POST', body), limited);
  expect(limited.statusCode).toBe(429); expect(limited.headers['Retry-After']).toBe('60');
  const failed = res();
  await createPurchaseHandler({ env, load, save, limit: async () => { throw new Error('secret database detail'); } })(req('POST', body), failed);
  expect(failed.statusCode).toBe(503); expect(JSON.stringify(failed.body)).not.toContain('secret database');
  expect(load).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
});

it('still rejects stale shared edits and a save from a different bank account', async () => {
  const load = async () => ({ base, snapshot: {} }), save = vi.fn();
  const handler = createPurchaseHandler({ env, load, save, limit: allowed });
  const stale = res(); await handler(req('POST', { id, revision: 0, baseVersion: 'old', draft }), stale);
  expect(stale.statusCode).toBe(409);
  const foreign = res(); await handler(req('POST', { id, revision: 0, baseVersion: householdVersion(base), draft: { ...draft, accountId: 'someone-else' } }), foreign);
  expect(foreign.statusCode).toBe(400); expect(save).not.toHaveBeenCalled();
});

it('loads shared purchases and live Nessie data for the hosted dashboard and chat', async () => {
  const load = vi.fn(async () => ({ base, snapshot: { asOf: base.today, source: 'nessie', dataset: 'demo' } }));
  const out = res(); await createHouseholdHandler({ env, load })(req(), out);
  expect(out.statusCode).toBe(200); expect(out.body.purchasesAvailable).toBe(true);
  expect(load).toHaveBeenCalledWith({ dataset: undefined, purchases: true, live: true });
  const chat = res(); await createContextHandler({ env, load, retrieve: async () => ({ status: 'matched', evidence: [] }), limit: allowed })(
    req('POST', { consent: true, baseVersion: householdVersion(base), plan: emptyPlan(), tool: 'get_current_plan', args: {} }), chat);
  expect(chat.statusCode).toBe(200);
  expect(load).toHaveBeenCalledWith({ dataset: 'demo', purchases: true, live: true });
});

it('does not substitute an older snapshot when the shared household cannot load', async () => {
  const load = vi.fn(async () => { throw new Error('private upstream detail'); });
  const out = res(); await createHouseholdHandler({ env, load })(req(), out);
  expect(out.statusCode).toBe(503); expect(out.body.household).toBeUndefined();
  expect(JSON.stringify(out.body)).not.toContain('private upstream');
  expect(load).toHaveBeenCalledWith({ dataset: undefined, purchases: true, live: true });
});

