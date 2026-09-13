import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHandler } from '../api/review.js';
import { householdVersion } from '../api/_review.js';
import { household } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { spendingBaseline } from '../src/engine/spending-baseline.js';

const origin = 'https://raincheck-planner.vercel.app';
const env = { VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production',
  RAINCHECK_SHARED_DEMO: '1', RAINCHECK_DEMO_ORIGIN: origin, RAINCHECK_PUBLIC_REVIEW: '1',
  ZEROCLAW_REVIEW_KEY: 'x'.repeat(64), RAINCHECK_CHAT_RATE_SECRET: 'test-only-secret-with-at-least-32-characters',
  SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_SECRET_KEY: 'test-db-key',
  NESSIE_KEY: 'test-bank-key', NESSIE_CUSTOMER_ID: 'customer', NESSIE_CHECKING_ID: 'checking', NESSIE_SAVINGS_ID: 'savings' };
const history = { checkingId: 'checking', merchants: [{ _id: 'dining', name: 'Demo restaurant', category: 'Dining' }],
  purchases: ['2026-07-01', '2026-08-01', '2026-09-01'].map((date, i) =>
    ({ _id: String(i), payer_id: 'checking', merchant_id: 'dining', purchase_date: date, amount: 80 })) };
const baseline = spendingBaseline(history, household.today);
const base = { ...household, checkingId: 'checking', plannedPurchases: [], allowances: baseline.allowances, spendingEvidence: baseline.evidence };
const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const input = () => ({ consent: true, baseVersion: householdVersion(base), plan: emptyPlan(), patch: {},
  kind: 'plan', question: 'Explain my current plan.' });
const request = (method = 'POST', body = input()) => ({ method, body, query: {}, socket: { remoteAddress: '10.0.0.1' },
  headers: { host: new URL(origin).host, origin, 'content-type': 'application/json', 'x-vercel-forwarded-for': '203.0.113.8' } });
const response = () => ({ statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
  status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
function setup(overrides = {}) {
  const deps = { env, load: vi.fn(async () => ({ base, snapshot: {} })),
    retrieve: vi.fn(async () => ({ status: 'outdated', evidence: [] })),
    review: vi.fn(async facts => ({ id, status: 'complete', facts,
      result: { summary: 'Keep essential spending covered.', observations: [], questions: [] } })),
    getSaved: vi.fn(async () => ({ id, status: 'complete' })),
    limit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })), ...overrides };
  return { ...deps, handler: createHandler(deps) };
}

it('advertises review availability on the explicitly configured public demo', async () => {
  const { handler, review, limit } = setup(); const res = response();
  await handler(request('GET'), res);
  expect(res.body).toMatchObject({ available: true, publicDemo: true });
  expect(review).not.toHaveBeenCalled(); expect(limit).not.toHaveBeenCalled();
});

it.each(['plan', 'goal', 'subscription', 'purchase'])('enables hosted %s explanations with live shared facts', async kind => {
  const body = { ...input(), kind, ...(kind === 'purchase' ? { patch: { draft: {
    label: 'Demo tickets', amount: 25, date: base.today, accountId: base.checkingId, allowanceId: null } } } : {}) };
  const before = JSON.stringify(body), { handler, load, review, limit } = setup(), res = response();
  await handler(request('POST', body), res);
  expect(res.statusCode).toBe(200); expect(res.body.review.status).toBe('complete');
  expect(load).toHaveBeenCalledWith({ live: true });
  expect(limit).toHaveBeenCalledWith(expect.anything(), 'session', env);
  expect(review.mock.calls[0][0]).toMatchObject({ source: 'nessie-demo', kind });
  expect(JSON.stringify(body)).toBe(before);
  expect(JSON.stringify(res.body)).not.toContain(env.ZEROCLAW_REVIEW_KEY);
});

it('returns editable optimization targets only after a successful hosted AI review', async () => {
  const { handler } = setup(), res = response();
  await handler(request('POST', { ...input(), focus: 'spending', optimize: true, protectedCategories: [] }), res);
  expect(res.statusCode).toBe(200); expect(res.body.optimization.draft.targets).toBeTruthy();
  expect(res.body.review.result.summary).toBeTruthy();
});

it('keeps preview deployments, missing configuration and cross-origin requests blocked', async () => {
  const configs = [{ RAINCHECK_PUBLIC_REVIEW: '0' }, { RAINCHECK_SHARED_DEMO: '0' }, { VERCEL_ENV: 'preview' },
    { ZEROCLAW_REVIEW_KEY: '' }, { ZEROCLAW_REVIEW_KEY: 'short' }, { NESSIE_CHECKING_ID: '' }, { SUPABASE_SECRET_KEY: '' }];
  for (const config of configs) {
    const { handler, load, review } = setup({ env: { ...env, ...config } }), res = response();
    await handler(request(), res); expect(res.statusCode).toBe(403);
    expect(load).not.toHaveBeenCalled(); expect(review).not.toHaveBeenCalled();
  }
  for (const headers of [{ origin: undefined }, { origin: 'https://other.example' }, { host: 'other.vercel.app' },
    { 'sec-fetch-site': 'cross-site' }, { 'content-type': 'text/plain' }]) {
    const { handler, load } = setup(), res = response(), req = request(); Object.assign(req.headers, headers);
    await handler(req, res); expect(res.statusCode).toBe(403); expect(load).not.toHaveBeenCalled();
  }
});

it('retains consent, validation and stale-data checks on hosting', async () => {
  for (const [body, status] of [[{ ...input(), consent: false }, 400], [{ ...input(), baseVersion: 'old' }, 409],
    [{ ...input(), before: { balance: 999999 } }, 400]]) {
    const { handler, review } = setup(), res = response(); await handler(request('POST', body), res);
    expect(res.statusCode).toBe(status); expect(review).not.toHaveBeenCalled();
  }
});

it('stops before data or AI calls when the durable quota denies or fails', async () => {
  for (const [limit, code] of [[async () => ({ allowed: false, retryAfter: 45 }), 429],
    [async () => { throw new Error('private credential'); }, 503]]) {
    const { handler, load, review } = setup({ limit }), res = response(); await handler(request(), res);
    expect(res.statusCode).toBe(code); expect(load).not.toHaveBeenCalled(); expect(review).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain('private credential');
    if (code === 429) expect(res.headers['Retry-After']).toBe('45');
  }
});

it('requires the issued link token to open a hosted saved review, not just a local review ID', async () => {
  const { handler, getSaved } = setup(), created = response(); await handler(request(), created);
  const token = created.body.review.accessToken;
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  for (const query of [{ id }, { id, token: '0'.repeat(64) }, { id: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee', token }]) {
    const res = response(); await handler({ ...request('GET'), query }, res);
    expect(res.statusCode).toBe(403);
  }
  expect(getSaved).not.toHaveBeenCalled();
  const res = response(); await handler({ ...request('GET'), query: { id, token } }, res);
  expect(res.statusCode).toBe(200); expect(res.body.review.id).toBe(id);
});

it('gives the review route enough time for the bounded model request', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  expect(config.functions['api/review.js'].maxDuration).toBeGreaterThanOrEqual(120);
});
