import { expect, it } from 'vitest';
import { buildFixture } from '../scripts/nessie-fixture.mjs';

it('builds a repeatable year of linked, synthetic bank activity', () => {
  const a = buildFixture();
  expect(a).toEqual(buildFixture());
  expect(a.records.length).toBeGreaterThan(400);
  expect(new Set(a.records.map(r => r.key)).size).toBe(a.records.length);
  expect(new Set(a.records.map(r => r.date.slice(0, 7))).size).toBe(12);
  for (const r of a.records) {
    expect(a.accounts.some(account => account.key === r.account)).toBe(true);
    expect(Number.isSafeInteger(r.amount)).toBe(true);
    expect(r.date <= a.asOf).toBe(true);
    if (r.merchant) expect(a.merchants.some(m => m.key === r.merchant)).toBe(true);
    if (r.bill) expect(a.bills.some(b => b.key === r.bill && b.merchant === r.merchant)).toBe(true);
  }
});

it('balances both sides of every transfer and reconciles balances to opening funds', () => {
  const f = buildFixture();
  const groups = new Set(f.records.filter(r => r.transfer).map(r => r.transfer));
  expect(groups.size).toBe(24);
  for (const key of groups) {
    const pair = f.records.filter(r => r.transfer === key);
    expect(pair).toHaveLength(2);
    expect(new Set(pair.map(r => r.account)).size).toBe(2);
    expect(pair.reduce((sum, r) => sum + (r.type === 'deposit' ? r.amount : -r.amount), 0)).toBe(0);
  }
  for (const a of f.accounts) {
    const net = f.records.filter(r => r.account === a.key).reduce((sum, r) => sum + (r.type === 'deposit' ? r.amount : -r.amount), 0);
    expect(a.balance).toBe(a.openingBalance + net);
    expect(a.balance).toBeGreaterThanOrEqual(0);
  }
});
