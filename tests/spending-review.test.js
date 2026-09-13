import { expect, it, vi } from 'vitest';
import { household as sample } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { householdVersion, calculateReview } from '../api/_review.js';
import { createHandler } from '../api/review.js';
import { spendingBaseline } from '../src/engine/spending-baseline.js';

const snapshot = { checkingId: 'a', merchants: [{ _id: 'd', name: 'PRIVATE MERCHANT', category: 'Dining' }],
  purchases: ['2026-07-01', '2026-07-20', '2026-08-01', '2026-08-20', '2026-09-01', '2026-09-12'].map((date, i) =>
    ({ _id: String(i), payer_id: 'a', merchant_id: 'd', purchase_date: date, amount: 40 })) };
const baseline = spendingBaseline(snapshot, sample.today);
const base = { ...sample, allowances: baseline.allowances, spendingEvidence: baseline.evidence };
const body = () => ({ consent: true, baseVersion: householdVersion(base), kind: 'plan', focus: 'spending', plan: emptyPlan(),
  patch: { cuts: { dining: 10 } }, question: 'Can I realistically spend less on dining?' });
const request = b => ({ method: 'POST', body: b, headers: { host: '127.0.0.1:5176', origin: 'http://127.0.0.1:5176', 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } });
const response = () => ({ statusCode: 200, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
it('accepts a spending-focused preview without accepting client-calculated evidence', () => {
  expect(calculateReview(base, body()).after).toBeDefined();
  expect(() => calculateReview(base, { ...body(), focus: 'unsafe' })).toThrow();
  expect(() => calculateReview(base, { ...body(), kind: 'purchase' })).toThrow();
  expect(() => calculateReview(base, { ...body(), evidence: [{ text: 'Invented balance' }] })).toThrow();
});
it('sends category spending and budget changes from trusted records to the existing ZeroClaw review', async () => {
  const review = vi.fn(async facts => ({ status: 'complete', facts, result: { summary: 'A calculated proposal.' } }));
  const handler = createHandler({ env: { RAINCHECK_AI_LOCAL: '1' }, load: async () => ({ base, snapshot }),
    retrieve: async () => ({ status: 'unavailable', evidence: [] }), review });
  const res = response(); await handler(request(body()), res);
  expect(res.statusCode).toBe(200); expect(review).toHaveBeenCalledOnce();
  const brief = review.mock.calls[0][0];
  const text = JSON.stringify(brief);
  expect(text).toContain('Dining'); expect(text).toContain('recorded $80');
  expect(text).toContain('$80 to $70'); expect(text).toContain('not money already saved');
  expect(text).not.toContain('PRIVATE MERCHANT'); expect(brief).not.toHaveProperty('snapshot');
  expect(brief.evidence.length).toBeLessThanOrEqual(4);
});
it('keeps the calculated proposal available when the cloud review fails', async () => {
  const handler = createHandler({ env: { RAINCHECK_AI_LOCAL: '1' }, load: async () => ({ base, snapshot }),
    retrieve: async () => ({ status: 'unavailable', evidence: [] }), review: async () => { throw new Error('secret'); } });
  const res = response(); await handler(request(body()), res);
  expect(res.statusCode).toBe(200); expect(res.body.review.status).toBe('unavailable');
  expect(res.body.impact.after).toBeDefined(); expect(JSON.stringify(res.body)).not.toContain('secret');
});
it('validates protected categories and rejects a proposal that lowers one', () => {
  expect(() => calculateReview(base, { ...body(), protectedCategories: ['dining'] })).toThrow();
  expect(() => calculateReview(base, { ...body(), protectedCategories: ['missing'] })).toThrow();
  expect(calculateReview(base, { ...body(), patch: {}, protectedCategories: ['dining'] }).after).toBeDefined();
});
it('analyzes a server-built budget proposal before returning editable limits', async () => {
  const review = vi.fn(async facts => ({ status: 'complete', facts, result: { summary: 'A smaller dining budget leaves room for your priorities.', observations: [], questions: [] } }));
  const handler = createHandler({ env: { RAINCHECK_AI_LOCAL: '1' }, load: async () => ({ base, snapshot }),
    retrieve: async () => ({ status: 'unavailable', evidence: [] }), review });
  const res = response();
  await handler(request({ ...body(), patch: {}, optimize: true }), res);
  expect(res.statusCode).toBe(200);
  expect(review).toHaveBeenCalledOnce();
  expect(res.body.optimization.draft.targets.dining).toBe(64);
  expect(res.body.optimization.draft.extras).toEqual({});
  expect(res.body.review.result.summary).toContain('dining');
  expect(JSON.stringify(review.mock.calls[0][0])).toContain('$80 to $64');
  expect(emptyPlan().cuts).toEqual({});
});
it('does not unlock editing with unreviewed limits when analysis fails', async () => {
  const handler = createHandler({ env: { RAINCHECK_AI_LOCAL: '1' }, load: async () => ({ base, snapshot }),
    retrieve: async () => ({ status: 'unavailable', evidence: [] }), review: async () => { throw new Error('private'); } });
  const res = response(); await handler(request({ ...body(), patch: {}, optimize: true }), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.review.status).toBe('unavailable');
  expect(res.body.optimization).toBeNull();
});
it('keeps protected budgets unchanged during optimization and rejects pre-filled client proposals', async () => {
  const review = vi.fn(async facts => ({ status: 'complete', facts, result: { summary: 'Keep essential budgets unchanged.', observations: [], questions: [] } }));
  const handler = createHandler({ env: { RAINCHECK_AI_LOCAL: '1' }, load: async () => ({ base, snapshot }),
    retrieve: async () => ({ status: 'unavailable', evidence: [] }), review });
  const res = response(); await handler(request({ ...body(), patch: {}, optimize: true, protectedCategories: ['dining'] }), res);
  expect(res.body.optimization.draft.targets.dining).toBe(80);
  expect(() => calculateReview(base, { ...body(), optimize: true })).toThrow();
  expect(() => calculateReview(base, { ...body(), patch: {}, optimize: false })).toThrow();
});

it('gives cloud review the goal funding gaps and distinguishes past overspending from future cuts', async () => {
  const h = { ...base, today: '2026-09-13', checking: 10000,
    income: [{ date: '2026-09-18', amount: 1800 }],
    goal: { label: 'Emergency fund', target: 2000, saved: 800, planned: 280, targetDate: '2026-12-18' },
    spendingEvidence: { ...base.spendingEvidence, asOf: '2026-09-13' } };
  const review = vi.fn(async facts => ({ status: 'complete', facts, result: { summary: 'Review remaining goal funding.' } }));
  const handler = createHandler({ env: { RAINCHECK_AI_LOCAL: '1' }, load: async () => ({ base: h, snapshot }),
    retrieve: async () => ({ status: 'unavailable', evidence: [] }), review });
  const res = response();
  await handler(request({ ...body(), baseVersion: householdVersion(h), patch: {}, optimize: true }), res);
  expect(res.statusCode).toBe(200);
  const brief = review.mock.calls[0][0];
  expect(JSON.stringify(brief.evidence)).toContain('needs $300/month; planned $280/month; extra needed $20/month');
  expect(brief.question).toContain('recovery is short');
  expect(brief.question).toContain('Never claim goal affordability means recovery is solved');
  expect(brief.evidence.length).toBeLessThanOrEqual(4);
});
