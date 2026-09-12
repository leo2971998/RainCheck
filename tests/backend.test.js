import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadNessieSnapshot } from '../api/_nessie.js';
import { transactionPage } from '../api/_transactions.js';
import transactionsHandler from '../api/transactions.js';
import { datasetConfig } from '../api/_dataset.js';

const config = { customerId: 'customer', checkingId: 'checking', savingsId: 'savings' };
afterEach(() => vi.unstubAllGlobals());
describe('connected Nessie records', () => {
  it('selects only explicitly configured profiles and never accepts arbitrary customer IDs', () => {
    const env = { NESSIE_CUSTOMER_ID: 'demo', NESSIE_TEST_CUSTOMER_ID: 'test', NESSIE_TEST_CHECKING_ID: 'test-checking',
      NESSIE_TEST_SAVINGS_ID: 'test-savings', NESSIE_TEST_AS_OF: '2026-09-28' };
    expect(datasetConfig('backend', env)).toMatchObject({ customerId: 'test', checkingId: 'test-checking', asOf: '2026-09-28' });
    expect(datasetConfig(undefined, env).customerId).toBe('demo');
    expect(() => datasetConfig('unrelated', env)).toThrow();
    expect(() => datasetConfig('backend', {})).toThrow();
  });
  it('reads both sides of the household and filters unrelated merchants', async () => {
    const request = async path => {
      if (path === '/customers/customer/accounts') return [
        { _id: 'checking', customer_id: 'customer' }, { _id: 'savings', customer_id: 'customer' }];
      if (path === '/merchants') return [{ _id: 'shop' }, { _id: 'unrelated' }];
      if (path === '/accounts/checking/purchases') return [{ _id: 'p1', merchant_id: 'shop' }];
      if (path === '/accounts/savings/deposits') return [{ _id: 'd1' }];
      return [];
    };
    const snap = await loadNessieSnapshot(config, request);
    expect(snap.accountRecords).toHaveLength(2);
    expect(snap.accountRecords[1].deposits[0]).toMatchObject({ account_id: 'savings', _id: 'd1' });
    expect(snap.merchants).toEqual([{ _id: 'shop' }]);
  });
  it('refuses accounts outside the configured customer', async () => {
    await expect(loadNessieSnapshot(config, async () => [])).rejects.toThrow(/account/i);
  });
  it('does not silently turn an upstream outage into an empty collection', async () => {
    const request = async path => {
      if (path.includes('/customers/')) return [{ _id: 'checking' }, { _id: 'savings' }];
      throw Object.assign(new Error('Unavailable'), { status: 503 });
    };
    await expect(loadNessieSnapshot(config, request)).rejects.toThrow('Unavailable');
  });
});

describe('transaction history for future CRUD', () => {
  const rows = Array.from({ length: 85 }, (_, i) => ({
    id: `deposit:${i}`, date: '2026-09-18', amount: 1700, kind: 'income', accountId: 'checking',
  }));
  it('paginates beyond the old 30 rows without losing identity', () => {
    const result = transactionPage(rows, { limit: '40', offset: '40' });
    expect(result).toMatchObject({ total: 85, nextOffset: 80, limit: 40 });
    expect(result.items[0].id).toBe('deposit:40');
    expect(result.items).toHaveLength(40);
  });
  it('filters before pagination and sums the whole result, not just this page', () => {
    const result = transactionPage([...rows, { id: 'refund:1', date: '2026-09-20', kind: 'refund', amount: 10 }], { kind: 'income', limit: '1' });
    expect(result.total).toBe(85);
    expect(result.totals.income).toBe(85 * 1700);
  });
  it('rejects invalid pagination and date filters', () => {
    for (const query of [{ limit: '-1' }, { limit: '1000' }, { offset: 'oops' }, { from: '2026-02-30' }, { from: '2026-10-01', to: '2026-09-01' }])
      expect(() => transactionPage(rows, query)).toThrow();
  });
  it('keeps the public history endpoint read-only', async () => {
    let status;
    const res = { setHeader() {}, status(code) { status = code; return this; }, json() {} };
    await transactionsHandler({ method: 'POST', query: {} }, res);
    expect(status).toBe(405);
  });
});
