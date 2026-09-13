import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { spendingBaseline } from '../src/engine/spending-baseline.js';
import { simulate } from '../src/engine/forecast.js';
import { purchaseSchedule } from '../src/engine/purchases.js';
import { monthlyOutlook } from '../src/engine/monthly-outlook.js';
import ForecastPage from '../src/pages/ForecastPage.jsx';

const snap = {
  checkingId: 'checking', accounts: [{ _id: 'checking', type: 'Checking', balance: 2500 }], bills: [], withdrawals: [],
  merchants: [{ _id: 'food', name: 'Grocery Store', category: 'Groceries' }, { _id: 'event', name: 'Concert tickets', category: 'Entertainment' }],
  purchases: [
    { _id: 'july-food', merchant_id: 'food', purchase_date: '2026-07-10', amount: 400 },
    { _id: 'aug-food', merchant_id: 'food', purchase_date: '2026-08-10', amount: 500 },
    { _id: 'sept-food', merchant_id: 'food', purchase_date: '2026-09-10', amount: 100 },
    { _id: 'july-event', merchant_id: 'event', purchase_date: '2026-07-12', amount: 200 },
  ],
};
const h = { today: '2026-09-28', windowDays: 34, checking: 2500, cushion: 200, spendingPeriod: 'calendar-month',
  checkingId: 'checking', allowances: [{ id: 'groceries', label: 'Groceries', monthly: 450 }],
  recurring: [{ id: 'electric', label: 'Electric', payee: 'Power Co', amount: 110, day: 6, everyMonths: 1, category: 'Utilities' }],
  income: [{ date: '2026-10-02', amount: 1500, label: 'Paycheck', status: 'estimated' }, { date: '2026-10-16', amount: 1500, label: 'Paycheck', status: 'estimated' }],
  goal: { label: 'Trip', target: 5000, saved: 1000, planned: 200, targetDate: '2027-12-02' }, plannedPurchases: [] };
const concert = { id: 'concert', label: 'October concert', merchant: 'Ticket shop', amount: 200, date: '2026-10-12', status: 'planned', allowanceId: null, accountId: 'checking' };

it('separates an explicit event from regular history and does not extrapolate a partial month as a whole month', () => {
  const { allowances, evidence } = spendingBaseline(snap, h.today);
  expect(allowances.find(a => a.id === 'groceries').monthly).toBe(450);
  expect(evidence.oneOffs).toMatchObject([{ label: 'Concert tickets', amount: 200, date: '2026-07-12' }]);
  expect(allowances.find(a => a.id === 'entertainment')?.monthly || 0).toBe(0);
  expect(evidence.baselineMonths).toEqual(['2026-07', '2026-08']);
  expect(evidence.categories.find(a => a.id === 'groceries').observedRange).toEqual([400, 500]);
});
it('does not throw out a large grocery transaction just because it is unusual', () => {
  const modified = structuredClone(snap); modified.purchases[1].amount = 1200;
  const { allowances, evidence } = spendingBaseline(modified, h.today);
  expect(allowances.find(a => a.id === 'groceries').monthly).toBe(800);
  expect(evidence.oneOffs).toHaveLength(1);
});
it('does not classify an explicitly recurring concert membership as a one-time event', () => {
  const modified = structuredClone(snap);
  modified.purchases.find(p => p._id === 'july-event').description = 'Monthly concert ticket membership';
  const { allowances, evidence } = spendingBaseline(modified, h.today);
  expect(evidence.oneOffs).toHaveLength(0);
  expect(allowances.find(a => a.id === 'entertainment').monthly).toBe(100);
});
it('does not use a month cut short by the lookback window as a complete month', () => {
  const modified = structuredClone(snap);
  modified.purchases.push({ _id: 'partial-june', merchant_id: 'food', purchase_date: '2026-06-20', amount: 20 });
  const { allowances, evidence } = spendingBaseline(modified, '2026-09-13');
  expect(evidence.baselineMonths).toEqual(['2026-07', '2026-08']);
  expect(evidence.months.find(m => m.key === '2026-06').partial).toBe(true);
  expect(allowances.find(a => a.id === 'groceries').monthly).toBe(450);
});
it.each(['2026-10', '2026-11', '2027-02'])('keeps a monthly amount exact across calendar month lengths: %s', month => {
  const base = { ...h, today: month + '-01', windowDays: new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate(), recurring: [], income: [] };
  const sim = simulate(base, { contribution: 0 });
  expect(sim.cash.everyday).toBe(450);
  expect(sim.days.at(-1).balance).toBe(2050);
});
it('puts a concert in October only, with no invented September or November repeat', () => {
  const base = { ...h, plannedPurchases: [concert] };
  const october = monthlyOutlook(base, { contribution: 200 }, '2026-10');
  const november = monthlyOutlook(base, { contribution: 200 }, '2026-11');
  expect(october.planned).toMatchObject([{ label: 'October concert', amount: 200, extra: 200 }]);
  expect(october.spending).toBe(450 + 110 + 200);
  expect(november.planned).toHaveLength(0);
  expect(november.spending).toBe(450 + 110);
  expect(october.savings).toBe(200);
  expect(november.savings).toBe(200);
});
it('counts a purchase covered by the existing category only once', () => {
  const base = { ...h, plannedPurchases: [{ ...concert, allowanceId: 'groceries' }] };
  const out = monthlyOutlook(base, { contribution: 200 }, '2026-10');
  expect(out.planned[0]).toMatchObject({ amount: 200, covered: 200, extra: 0 });
  expect(out.spending).toBe(560);
  expect(out.rows.find(r => r.id === 'groceries').expected).toBe(450);
  expect(purchaseSchedule(base).allocations.concert.covered).toBe(200);
});
it('ignores completed and cancelled plans; editing the date moves the cost, without mutating input', () => {
  const base = { ...h, plannedPurchases: [{ ...concert, date: '2026-11-12' }, { ...concert, id: 'done', status: 'completed' }, { ...concert, id: 'gone', status: 'cancelled' }] };
  const saved = JSON.stringify(base);
  expect(monthlyOutlook(base, { contribution: 0 }, '2026-10').planned).toHaveLength(0);
  expect(monthlyOutlook(base, { contribution: 0 }, '2026-11').extra).toBe(200);
  expect(JSON.stringify(base)).toBe(saved);
});
it('does not mistake missing planned purchases for a guarantee of no unexpected fees', () => {
  const out = monthlyOutlook(h, { contribution: 200 }, '2026-10');
  expect(out.unplannedCostsKnown).toBe(false);
  expect(() => monthlyOutlook(h, {}, '2026-13')).toThrow();
});
it('keeps the forecast focused on the monthly summary and recorded comparison', () => {
  const base = { ...h, plannedPurchases: [concert] };
  const html = renderToStaticMarkup(<ForecastPage h={base} sc={{ contribution: 200 }} plan={{}} sim={simulate(base, { contribution: 200 })} cap={200} />);
  expect(html).toContain('Expected spending');
  for (const removed of ['Usual costs', 'Different this month', 'October concert', 'No extra costs planned', 'Plan or edit a purchase', 'Monthly totals do not show'])
    expect(html).not.toContain(removed);
  expect(html).not.toContain('See all 34 days');
  expect(html).not.toContain('90-day lookback ÷');
  expect(html).not.toMatch(/<details[^>]*\bopen/);
});

it('shows the monthly table without the removed detailed planning cards', () => {
  const base = { ...h, spendingEvidence: spendingBaseline(snap, h.today).evidence };
  const html = renderToStaticMarkup(<ForecastPage h={base} sc={{ contribution: 200 }} />);
  expect(html).toContain('class="mc-table"');
  expect(html).toContain('Every month on record');
  expect(html).not.toContain('class="monthly-columns"');
  expect(html).not.toContain('class="month-bottom-line"');
  expect(html).not.toContain('class="mc-bars"');
  expect(html).not.toContain('Your monthly goal savings');
  expect(html).not.toContain('goal savings');
});
