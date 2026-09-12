import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { prepareKnowledge } from '../scripts/supabase-knowledge.mjs';

const sample = JSON.parse(readFileSync(new URL('../data/nessie-snapshot.json', import.meta.url), 'utf8'));
function snapshot() {
  const s = structuredClone(sample);
  s.customerId ||= s.accounts[0].customer_id;
  s.checkingId ||= s.accounts.find(a => a.type === 'Checking')._id;
  s.savingsId ||= s.accounts.find(a => a.type === 'Savings')._id;
  s.source = 'nessie';
  s.accountRecords ||= s.accounts.map(a => ({ accountId: a._id,
    bills: a._id === s.checkingId ? s.bills : [], deposits: a._id === s.checkingId ? s.deposits : [],
    purchases: a._id === s.checkingId ? s.purchases : [], withdrawals: a._id === s.checkingId ? s.withdrawals || [] : [] }));
  return s;
}
const options = { dataset: 'demo', asOf: '2026-09-28' };

describe('Nessie knowledge import', () => {
  it('links posted transactions to owned accounts and searchable source records', () => {
    const p = prepareKnowledge(snapshot(), options);
    expect(p.transactions.length).toBeGreaterThan(90);
    expect(p.accounts).toHaveLength(2);
    for (const t of p.transactions) {
      expect(Number.isSafeInteger(t.amount_cents)).toBe(true);
      expect(p.accounts.some(a => a.id === t.account_id)).toBe(true);
      expect(p.documents.some(d => d.id === `transaction:${t.id}` && d.source_id === t.source_id)).toBe(true);
    }
    expect(p.documents.find(d => d.id === 'forecast:income').body).toContain('Estimated');
    expect(p.household.today).toBe(options.asOf);
  });
  it('includes savings activity but excludes future and pending records from posted totals', () => {
    const s = snapshot();
    const savings = s.accountRecords.find(a => a.accountId === s.savingsId);
    savings.deposits.push({ _id: 'saved', account_id: s.savingsId, amount: 12.34, transaction_date: '2026-09-01', status: 'completed', description: 'Transfer from checking' });
    savings.deposits.push({ _id: 'future', amount: 30, transaction_date: '2026-10-01', status: 'completed', description: 'Future deposit' });
    savings.deposits.push({ _id: 'pending', amount: 40, transaction_date: '2026-09-01', status: 'pending', description: 'Pending deposit' });
    const p = prepareKnowledge(s, options);
    expect(p.transactions.find(t => t.source_id === 'saved')).toMatchObject({ amount_cents: 1234, kind: 'transfer', account_id: s.savingsId });
    expect(p.transactions.some(t => ['future', 'pending'].includes(t.source_id))).toBe(false);
    expect(p.source_snapshot.accountRecords.find(a => a.accountId === s.savingsId).deposits).toHaveLength(3);
  });
  it('uses a stable fingerprint when only fetch time or API record order changes', () => {
    const a = snapshot(), b = structuredClone(a);
    b.capturedAt = '2026-09-12T23:00:00Z'; b.accounts.reverse(); b.merchants.reverse();
    expect(prepareKnowledge(a, options).fingerprint).toBe(prepareKnowledge(b, options).fingerprint);
    b.accounts[0].balance += 1;
    expect(prepareKnowledge(a, options).fingerprint).not.toBe(prepareKnowledge(b, options).fingerprint);
  });
  it('rejects a mixed-customer snapshot and invalid date rather than merging households', () => {
    const s = snapshot(); s.accounts[0].customer_id = 'someone-else';
    expect(() => prepareKnowledge(s, options)).toThrow('customer');
    expect(() => prepareKnowledge(snapshot(), { ...options, asOf: '2026-02-30' })).toThrow('date');
    expect(() => prepareKnowledge(snapshot(), { ...options, dataset: 'anything' })).toThrow('dataset');
  });
});
