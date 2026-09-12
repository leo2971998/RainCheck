import { describe, expect, it, vi } from 'vitest';
import { household as base } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { budgetImpact, readSubscription, subscriptionPatch } from '../src/engine/budget.js';
import { budgetStatus } from '../src/engine/review-status.js';
import { calculateReview, householdVersion, readReviewPlan, reviewBrief } from '../api/_review.js';
import { createHandler } from '../api/review.js';

const requestBody = () => ({ consent: true, baseVersion: householdVersion(base), plan: emptyPlan(), patch: {},
  kind: 'plan', question: 'What should I check in my savings plan?' });
const req = body => ({ method: 'POST', body, headers: { host: '127.0.0.1:5176', origin: 'http://127.0.0.1:5176', 'content-type': 'application/json' },
  socket: { remoteAddress: '127.0.0.1' } });
const response = () => ({ statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
const env = { RAINCHECK_AI_LOCAL: '1' };

describe('calculator before AI review', () => {
  it('recomputes subscription impact from the trusted household and sends exact cents', () => {
    const patch = subscriptionPatch('sub-test', readSubscription({ label: 'Streaming', amount: 75, startsOn: base.today }, base.today));
    const body = { ...requestBody(), kind: 'subscription', patch };
    const impact = calculateReview(base, body);
    expect(impact).toEqual(budgetImpact(base, emptyPlan(), patch));
    const brief = reviewBrief(impact, body, []);
    expect(brief.after.lowCents).toBe(Math.round(impact.after.low * 100));
    expect(brief.after.contributionFits).toBe(impact.after.fits);
    expect(JSON.stringify(brief)).not.toContain('Streaming');
  });
  it('rejects stale base data and client-supplied calculated facts', () => {
    expect(() => calculateReview(base, { ...requestBody(), baseVersion: 'old' })).toThrow('changed');
    expect(() => calculateReview(base, { ...requestBody(), before: { low: 100000 } })).toThrow();
    expect(() => readReviewPlan({ ...emptyPlan(), checking: 100000 }, base)).toThrow();
  });
  it('rejects unbounded scenarios, unknown bill IDs and invalid dates', () => {
    for (const changes of [{ contribution: Infinity }, { contribution: -1 }, { goalDate: '2026-02-30' },
      { cuts: { groceries: 1000000 } }, { cancelled: { other: true } }, { income: [{ date: '1900-01-01', amount: 100 }] }])
      expect(() => readReviewPlan({ ...emptyPlan(), ...changes }, base)).toThrow();
  });
  it('keeps edited income and accepted notices consistent with the website calculator', () => {
    const plan = emptyPlan();
    plan.income = base.income.map((p, i) => ({ ...p, amount: i === 0 ? p.amount + 12.34 : p.amount, status: 'edited' }));
    plan.billChanges[base.recurring[0].id] = { to: 90, effective: base.today, why: 'An entered estimate', evidence: ['Example notice'] };
    const body = { ...requestBody(), plan };
    expect(calculateReview(base, body)).toEqual(budgetImpact(base, plan, {}));
  });
  it('keeps pending cancellations conditional, and does not mutate accepted decisions', () => {
    const body = requestBody(); body.plan.pendingCancel[base.recurring[0].id] = true;
    const before = JSON.stringify(body);
    expect(calculateReview(base, body).after.low).toBe(budgetImpact(base, emptyPlan(), {}).after.low);
    expect(JSON.stringify(body)).toBe(before);
  });
  it('never calls a goal affordable just because contribution arithmetic reaches its target', () => {
    const status = budgetStatus({ fits: false, gap: 0, low: 125 }, 200);
    expect(status.tone).toBe('warn');
    expect(status.label).not.toMatch(/on track|fits/i);
    expect(budgetStatus({ fits: true, gap: 0, low: 400 }, 200).tone).toBe('good');
  });
});

describe('local website AI boundary', () => {
  const setup = overrides => {
    const dependencies = { env, load: vi.fn(async () => ({ base, snapshot: {} })),
      retrieve: vi.fn(async () => ({ status: 'unavailable', evidence: [] })),
      review: vi.fn(async brief => ({ id: 'test', status: 'complete', facts: brief, result: { summary: 'A review.' } })), ...overrides };
    return { dependencies, handler: createHandler(dependencies) };
  };
  it('requires explicit consent and same-origin loopback, and is disabled on Vercel', async () => {
    for (const change of [r => { r.body.consent = false; }, r => { r.headers.origin = 'https://evil.example'; },
      r => { r.socket.remoteAddress = '10.0.0.8'; }, r => { r.headers.host = 'evil.example'; }]) {
      const { handler, dependencies } = setup(); const r = req(requestBody()), res = response(); change(r);
      await handler(r, res); expect(res.statusCode).toBeGreaterThanOrEqual(400); expect(dependencies.review).not.toHaveBeenCalled();
    }
    const { handler, dependencies } = setup({ env: { ...env, VERCEL: '1' } }); const res = response();
    await handler(req(requestBody()), res); expect(res.statusCode).toBe(403); expect(dependencies.load).not.toHaveBeenCalled();
  });
  it('returns calculated results and a clear fallback when the model is unavailable', async () => {
    const { handler } = setup({ review: vi.fn(async () => { throw new Error('secret-token provider failure'); }) });
    const res = response(); await handler(req(requestBody()), res);
    expect(res.statusCode).toBe(200); expect(res.body.impact.after.low).toBeTypeOf('number');
    expect(res.body.review.status).toBe('unavailable'); expect(JSON.stringify(res.body)).not.toContain('secret-token');
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });
  it('stops before retrieval and AI if the website has an older household', async () => {
    const { handler, dependencies } = setup(); const res = response();
    await handler(req({ ...requestBody(), baseVersion: 'old' }), res);
    expect(res.statusCode).toBe(409); expect(dependencies.retrieve).not.toHaveBeenCalled(); expect(dependencies.review).not.toHaveBeenCalled();
  });
  it('does not expose programming errors for malformed patches', async () => {
    const { handler, dependencies } = setup(); const res = response();
    await handler(req({ ...requestBody(), patch: { goals: null } }), res);
    expect(res.statusCode).toBe(400); expect(res.body.message).not.toMatch(/undefined|null|TypeError/);
    expect(dependencies.review).not.toHaveBeenCalled();
  });
  it('forwards only the calculated brief and bounded matched evidence to the AI', async () => {
    const { handler, dependencies } = setup(); const res = response();
    await handler(req(requestBody()), res);
    expect(res.statusCode).toBe(200); expect(dependencies.review).toHaveBeenCalledOnce();
    expect(dependencies.review.mock.calls[0][0].after.lowCents).toBe(Math.round(res.body.impact.after.low * 100));
    expect(dependencies.review.mock.calls[0][0]).not.toHaveProperty('plan');
    expect(res.body.retrieval.status).toBe('unavailable');
  });
});
