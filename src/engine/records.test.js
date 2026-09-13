import { describe, expect, it } from 'vitest';
import { buildHousehold } from './household.js';
import { transactionRecords } from './records.js';
import { discoverCommitments } from './discover.js';

const today = '2026-09-28';
const deposit = (id, date, amount = 1700, description = 'Payroll Example Co', extra = {}) =>
  ({ _id: id, account_id: 'checking', transaction_date: date, amount, description, status: 'completed', ...extra });
const snapshot = extra => ({ checkingId: 'checking', savingsId: 'savings', accounts: [
  { _id: 'wrong', type: 'Checking', balance: 999 },
  { _id: 'checking', type: 'Checking', balance: 1260 },
  { _id: 'savings', type: 'Savings', balance: 800 },
], deposits: [deposit('pay1', '2026-09-04'), deposit('pay2', '2026-09-18')], ...extra });

describe('one source for posted activity and expected income', () => {
  it('keeps the posted payment history for every recurring bill', () => {
    const s = snapshot({
      bills: [{ _id: 'bill-internet', nickname: 'Internet', payee: 'Northline Internet',
        payment_amount: 65, recurring_date: 1 }],
      merchants: [{ _id: 'internet', name: 'Northline Internet', category: 'Utilities' }],
      purchases: [
        { _id: 'jul', merchant_id: 'internet', amount: 60, purchase_date: '2026-07-01', status: 'completed' },
        { _id: 'sep', merchant_id: 'internet', amount: 65, purchase_date: '2026-09-01', status: 'completed' },
        { _id: 'aug', merchant_id: 'internet', amount: 65, purchase_date: '2026-08-01', status: 'completed' },
      ],
    });

    expect(buildHousehold(s, today).recurring[0].paymentHistory).toEqual([
      { id: 'sep', date: '2026-09-01', amount: 65 },
      { id: 'aug', date: '2026-08-01', amount: 65 },
      { id: 'jul', date: '2026-07-01', amount: 60 },
    ]);
  });

  it('does not quadruple a monthly subscription when loading a year of history', () => {
    const s = snapshot({ merchants: [{ _id: 'music', name: 'Music Club', category: 'Entertainment' }],
      purchases: Array.from({ length: 12 }, (_, i) => ({ _id: `music-${i}`, merchant_id: 'music', amount: 12,
        purchase_date: new Date(Date.UTC(2025, 9 + i, 20)).toISOString().slice(0, 10), status: 'completed' })) });
    const h = buildHousehold(s, today);
    expect(discoverCommitments(s, h)[0].monthlyShare).toBe(12);
  });

  it('exposes transfer counterpart IDs only when both sides match uniquely', () => {
    const out = { _id: 'out', transaction_date: '2026-09-20', amount: 150, status: 'completed', description: 'Transfer to savings' };
    const incoming = deposit('in', '2026-09-20', 150, 'Transfer from checking', { account_id: 'savings' });
    const s = snapshot({ accountRecords: [
      { accountId: 'checking', withdrawals: [out] }, { accountId: 'savings', deposits: [incoming] },
    ] });
    expect(transactionRecords(s, today)[0]).toMatchObject({ counterpartId: 'deposit:in', counterpartAccountId: 'savings', relationshipStatus: 'matched' });
    s.accountRecords[1].deposits.push({ ...incoming, _id: 'duplicate' });
    expect(transactionRecords(s, today)[0]).toMatchObject({ counterpartId: null, relationshipStatus: 'ambiguous' });
  });
  it('uses the configured checking account, not the first account of that type', () => {
    expect(buildHousehold(snapshot(), today).checking).toBe(1260);
  });

  it('links estimates to the exact posted deposits and uses their latest amount', () => {
    const s = snapshot({ deposits: [deposit('p1', '2026-09-04'), deposit('p2', '2026-09-18', 1800)] });
    const h = buildHousehold(s, today);
    const rows = transactionRecords(s, today);
    expect(h.income[0]).toMatchObject({ date: '2026-10-02', amount: 1800, status: 'estimated', cadenceDays: 14 });
    expect(h.income[0].sourceTransactionIds).toEqual(['deposit:p1', 'deposit:p2']);
    expect(rows.find(r => r.id === h.income[0].sourceTransactionIds.at(-1)).amount).toBe(h.income[0].amount);
  });

  it('does not treat transfers, refunds, pending, future, or other-account deposits as payroll', () => {
    const s = snapshot();
    s.deposits.push(deposit('transfer', '2026-09-20', 900, 'Transfer from savings'),
      deposit('refund', '2026-09-21', 75, 'Refund for returned item'),
      deposit('pending', '2026-09-22', 7000, 'Payroll Example Co', { status: 'pending' }),
      deposit('future', '2026-10-02', 9000),
      deposit('foreign', '2026-09-25', 8000, 'Payroll Example Co', { account_id: 'wrong' }));
    const h = buildHousehold(s, today);
    expect(h.income[0]).toMatchObject({ amount: 1700, date: '2026-10-02' });
    expect(h.history.at(-1).inc).toBe(3400);
    expect(transactionRecords(s, today).map(r => r.kind).sort()).toEqual(['income', 'income', 'refund', 'transfer']);
  });

  it('does not invent recurring income from one deposit or duplicate same-day records', () => {
    expect(buildHousehold(snapshot({ deposits: [deposit('one', '2026-09-18')] }), today).income).toEqual([]);
    expect(buildHousehold(snapshot({ deposits: [deposit('one', '2026-09-18'), deposit('two', '2026-09-18')] }), today).income).toEqual([]);
  });

  it('excludes future and pending purchases from learned spending', () => {
    const s = snapshot({ purchases: [
      { _id: 'p', payer_id: 'checking', purchase_date: '2026-09-20', amount: 90, status: 'completed' },
      { _id: 'q', payer_id: 'checking', purchase_date: '2026-10-01', amount: 900, status: 'completed' },
      { _id: 'r', payer_id: 'checking', purchase_date: '2026-09-21', amount: 900, status: 'pending' },
    ] });
    const h = buildHousehold(s, today);
    expect(h.allowances[0].monthly).toBe(90);
    expect(h.spendingEvidence.categories[0].provisional).toBe(true);
  });

  it('keeps actual cash withdrawals as spending, not savings contributions', () => {
    const s = snapshot({ withdrawals: [
      { _id: 'atm', payer_id: 'checking', transaction_date: '2026-09-20', amount: 50, status: 'completed', description: 'ATM cash' },
      { _id: 'move', payer_id: 'checking', transaction_date: '2026-09-21', amount: 300, status: 'completed', description: 'Transfer to savings' },
    ] });
    expect(transactionRecords(s, today).find(r => r.id === 'withdrawal:atm').kind).toBe('withdrawal');
    expect(buildHousehold(s, today).history.at(-1).out).toBe(50);
    expect(buildHousehold(s, today).allowances).toContainEqual({ id: 'cash-withdrawals', label: 'Cash withdrawals', monthly: 50 });
  });
});
