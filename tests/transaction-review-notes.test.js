import { expect, it } from 'vitest';
import { recentTransactions } from '../api/household.js';

const today = '2026-09-13';
const household = {
  today,
  recurring: [{
    id: 'electric', label: 'Electric', payee: 'Reliant Energy', amount: 108,
    usual: 108, lastPosted: 196, lastPostedDate: '2026-09-06', unexplained: true,
  }],
};
const snapshot = {
  accounts: [{ _id: 'checking', type: 'Checking' }],
  merchants: [{ _id: 'reliant', name: 'Reliant Energy' }, { _id: 'coffee', name: 'Coffee Spot' }],
  bills: [{ _id: 'bill-electric', account_id: 'checking', payee: 'Reliant Energy', nickname: 'Utilities', status: 'recurring' }],
  purchases: [{ _id: 'electric-charge', payer_id: 'checking', merchant_id: 'reliant', amount: 196,
    purchase_date: '2026-09-06', status: 'completed' },
  { _id: 'old-electric-charge', payer_id: 'checking', merchant_id: 'reliant', amount: 196,
    purchase_date: '2025-09-06', status: 'completed' }, ...Array.from({ length: 4 }, (_, index) => ({
    _id: `coffee-${index}`, payer_id: 'checking', merchant_id: 'coffee', amount: 5,
    purchase_date: `2026-09-${String(index + 7).padStart(2, '0')}`, status: 'completed',
  }))],
  deposits: [], withdrawals: [], transfers: [],
};

it('routes unexplained bill differences to Recurring without flagging the transaction', () => {
  const rows = recentTransactions(snapshot, household);
  const electric = rows.find(row => row.what === 'Reliant Energy');
  const repeatedCoffee = rows.find(row => row.note?.includes('charges this month'));

  expect(electric.review).not.toBe(true);
  expect(electric.note).toContain('Recurring');
  expect(rows.filter(row => row.review)).toHaveLength(0);
  expect(repeatedCoffee.review).not.toBe(true);
});
