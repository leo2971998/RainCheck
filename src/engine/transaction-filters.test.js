import { describe, it, expect } from 'vitest';
import { dateBounds, filterTransactions, sortTransactions } from './transaction-filters.js';

describe('transaction filters', () => {
  const now = new Date(2026, 0, 3, 23, 30);
  it('uses local calendar dates across month and year boundaries', () => {
    expect(dateBounds('today', '', '', now)).toEqual(['2026-01-03', '2026-01-03']);
    expect(dateBounds('week', '', '', now)).toEqual(['2025-12-28', '2026-01-03']);
    expect(dateBounds('month', '', '', now)).toEqual(['2026-01-01', '2026-01-31']);
    expect(dateBounds('last-month', '', '', now)).toEqual(['2025-12-01', '2025-12-31']);
    expect(dateBounds('last-month', '', '', new Date(2024, 2, 5))).toEqual(['2024-02-01', '2024-02-29']);
  });
  const rows = [
    { date: '2025-12-28', d: 'Dec 28', what: 'Market', cat: 'Groceries', amt: -50, k: 'ev' },
    { date: '2026-01-03', d: 'Jan 3', what: 'Market refund', cat: 'Groceries', amt: 50, k: 'in' },
    { date: '2026-01-04', d: 'Jan 4', what: 'Cafe', cat: 'Dining', amt: -12, k: 'ev' },
  ];
  it('combines search, category, inclusive dates and absolute amount bounds', () => {
    expect(filterTransactions(rows, { query: ' MARKET ', category: 'Groceries', date: 'week', min: '50', max: '50' }, now)).toEqual(rows.slice(0, 2));
    expect(filterTransactions(rows, { kind: 'in', date: 'today' }, now)).toEqual([rows[1]]);
  });
  it('supports open-ended custom ranges and empty results', () => {
    expect(filterTransactions(rows, { date: 'custom', to: '2025-12-28' })).toEqual([rows[0]]);
    expect(filterTransactions(rows, { date: 'custom', from: '2026-01-04' })).toEqual([rows[2]]);
    expect(filterTransactions(rows, { min: '100', max: '10' })).toEqual([]);
    expect(filterTransactions(rows, { date: 'custom', from: '2026-01-04', to: '2025-12-28' })).toEqual([]);
    expect(filterTransactions(rows)).toEqual(rows);
  });
});


describe('transaction sorting', () => {
  const rows = [
    { date: '2026-01-01', amt: -100, note: 'Check charge' },
    { date: '2026-01-03', amt: 20 },
    { date: '2026-01-02', amt: -20, note: 'Check merchant' },
  ];
  it('sorts absolute amounts in both directions, breaking ties by newest date', () => {
    expect(sortTransactions(rows, 'amount-asc')).toEqual([rows[1], rows[2], rows[0]]);
    expect(sortTransactions(rows, 'amount-desc')).toEqual([rows[0], rows[1], rows[2]]);
  });
  it('puts review transactions first and keeps both groups newest first', () => {
    expect(sortTransactions(rows, 'review')).toEqual([rows[2], rows[0], rows[1]]);
  });
  it('defaults to newest first without mutating the source and sorts filtered results', () => {
    const original = [...rows];
    expect(sortTransactions(rows)).toEqual([rows[1], rows[2], rows[0]]);
    expect(rows).toEqual(original);
    expect(sortTransactions(filterTransactions(rows, { min: '50' }), 'review')).toEqual([rows[0]]);
    expect(sortTransactions([], 'review')).toEqual([]);
  });
});
