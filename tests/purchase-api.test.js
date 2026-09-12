import { describe, expect, it, vi } from 'vitest';
import { createPurchaseHandler } from '../api/purchases.js';
import { householdVersion } from '../api/_review.js';
import { household } from '../data/household.sample.js';
const base = { ...household, checkingId: 'checking', plannedPurchases: [] };
const id = '24e08bab-b1ca-4698-b1b5-2633e5017207';
const draft = { label: 'Tickets', merchant: 'Ticket shop', amount: 200, date: base.today, accountId: 'checking', allowanceId: null };
const request = (method = 'POST', body = {}) => ({ method, query: {}, body, socket: { remoteAddress: '127.0.0.1' },
  headers: { host: '127.0.0.1:5176', origin: 'http://127.0.0.1:5176', 'content-type': 'application/json' } });
const response = () => ({ statusCode: 200, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; } });
const setup = (changes = {}) => {
  const load = vi.fn(async () => ({ base, snapshot: {} })), save = vi.fn(async (id, revision, record) => ({ ...record, id, revision: revision + 1 }));
  return { load, save, handler: createPurchaseHandler({ env: { RAINCHECK_AI_LOCAL: '1' }, load, save, ...changes }) };
};
const body = () => ({ id, revision: 0, baseVersion: householdVersion(base), draft });

describe('planned purchase API', () => {
  it('creates a validated estimate, never accepting client status or matched transactions', async () => {
    const { handler, save } = setup(), res = response();
    await handler(request('POST', { ...body(), draft: { ...draft, status: 'completed', transactionId: 'fake' } }), res);
    expect(res.statusCode).toBe(200); expect(save.mock.calls[0][2]).toEqual({ ...draft, status: 'planned' });
  });
  it('rejects remote callers, cross-origin writes and production before reading or writing', async () => {
    for (const modify of [r => r.socket.remoteAddress = '10.0.0.2', r => r.headers.origin = 'https://evil.example', r => r.headers.host = 'evil.example']) {
      const { handler, load, save } = setup(), req = request('POST', body()), res = response(); modify(req);
      await handler(req, res); expect(res.statusCode).toBe(403); expect(load).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
    }
    const { handler, save } = setup({ env: { RAINCHECK_AI_LOCAL: '1', VERCEL: '1' } }), res = response();
    await handler(request('POST', body()), res); expect(res.statusCode).toBe(403); expect(save).not.toHaveBeenCalled();
  });
  it('rejects stale forecasts, unknown purchases and incomplete input', async () => {
    for (const [method, payload] of [['POST', { ...body(), baseVersion: 'old' }], ['PUT', body()], ['POST', { ...body(), draft: { ...draft, amount: -1 } }]]) {
      const { handler, save } = setup(), res = response(); await handler(request(method, payload), res);
      expect(res.statusCode).toBeGreaterThanOrEqual(400); expect(save).not.toHaveBeenCalled();
    }
  });
  it('retains cancelled history and checks the record revision', async () => {
    const record = { ...draft, id, revision: 2, status: 'planned' }, current = { ...base, plannedPurchases: [record] };
    const { handler, save } = setup({ load: async () => ({ base: current, snapshot: {} }) }), res = response();
    await handler(request('DELETE', { id, revision: 2, baseVersion: householdVersion(current) }), res);
    expect(res.statusCode).toBe(200); expect(save.mock.calls[0][2].status).toBe('cancelled');
    const stale = response(); await handler(request('PUT', { ...body(), baseVersion: householdVersion(current) }), stale);
    expect(stale.statusCode).toBe(409);
  });
  it('never hides a database failure or exposes a raw server error', async () => {
    const { handler } = setup({ load: async () => { throw new Error('secret database credentials'); } }), res = response();
    await handler(request('GET'), res); expect(res.statusCode).toBe(503); expect(JSON.stringify(res.body)).not.toContain('secret');
  });
  it('re-reads live bank records on confirmation and rejects a charge that became pending', async () => {
    const record = { ...draft, id, revision: 1, status: 'planned' }, current = { ...base, plannedPurchases: [record] };
    const snapshot = { checkingId: 'checking', merchants: [{ _id: 'merchant', name: 'Ticket shop' }], purchases: [
      { _id: 'charge', payer_id: 'checking', merchant_id: 'merchant', amount: 200, purchase_date: base.today, status: 'pending' }] };
    const load = vi.fn(async () => ({ base: current, snapshot })), { handler, save } = setup({ load }), res = response();
    const payload = { id, revision: 1, baseVersion: householdVersion(current), action: 'match', confirmed: true, transactionId: 'purchase:charge' };
    await handler(request('POST', payload), res);
    expect(load).toHaveBeenCalledWith({ live: true }); expect(res.statusCode).toBe(400); expect(save).not.toHaveBeenCalled();
    snapshot.purchases[0].status = 'completed'; const success = response(); await handler(request('POST', payload), success);
    expect(success.statusCode).toBe(200); expect(save.mock.calls[0][2]).toMatchObject({ status: 'completed', actualAmount: 200, transactionId: 'purchase:charge' });
  });
});
