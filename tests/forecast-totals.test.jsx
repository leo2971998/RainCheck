import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ForecastPage from '../src/pages/ForecastPage.jsx';
import MonthsCompare from '../src/components/MonthsCompare.jsx';
import { monthlyOutlook } from '../src/engine/monthly-outlook.js';
import { budgetMoney } from '../src/components/BudgetImpact.jsx';

const categories = [
  ['groceries', 'Groceries', 816], ['fun', 'Fun & other', 247], ['dining', 'Dining & takeout', 200],
  ['household', 'Household', 176], ['rides', 'Rides & transit', 60],
].map(([id, label, monthly]) => ({ id, label, monthly, total: monthly * 2,
  months: [{ key: '2026-07', total: monthly - 10 }, { key: '2026-08', total: monthly + 10 }] }));
const evidence = { months: [{ key: '2026-07' }, { key: '2026-08' }], categories, oneOffs: [] };
const h = { today: '2026-09-13', checkingId: 'checking', checking: 4000, cushion: 200, windowDays: 34,
  spendingPeriod: 'calendar-month', allowances: categories.map(({ id, label, monthly }) => ({ id, label, monthly })),
  spendingEvidence: evidence, plannedPurchases: [], income: [],
  recurring: [{ id: 'rent', label: 'Rent', amount: 1385, day: 5, everyMonths: 1 },
    { id: 'electric', label: 'Electric', amount: 208, category: 'Utilities', day: 16, everyMonths: 1 }],
  goal: { label: 'Trip', target: 2000, saved: 800, planned: 0, targetDate: '2027-01-02' } };
const purchase = { id: 'tickets', label: 'Concert tickets', amount: 200, date: '2026-10-12',
  status: 'planned', accountId: 'checking', allowanceId: null };
const row = (html, label) => [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].find(m => m[1].includes(`>${label}<`))?.[1];

it('reconciles the category subtotal plus bills to the headline in one table', () => {
  const html = renderToStaticMarkup(<ForecastPage h={h} sc={{ contribution: 0 }} />);
  expect(row(html, 'Everyday spending subtotal')).toContain('$1,499');
  expect(row(html, 'Utilities &amp; internet')).toContain('$208');
  expect(row(html, 'Rent &amp; other bills')).toContain('$1,385');
  expect(row(html, 'Total expected spending')).toContain('$3,092');
  expect(html).toContain('<strong class="num">$3,092</strong>');
  expect(row(html, 'Total')).toBeUndefined();
});

it('shows the selected plan amounts instead of reusing the untouched historical baseline', () => {
  const html = renderToStaticMarkup(<ForecastPage h={h} sc={{ contribution: 0, cuts: { groceries: 50 } }} />);
  expect(row(html, 'Groceries')).toContain('$766');
  expect(row(html, 'Groceries')).not.toContain('<b>$816</b>');
  expect(row(html, 'Total expected spending')).toContain('$3,042');
});

it.each([null, 'groceries'])('adds only the extra portion of a planned purchase: %s', allowanceId => {
  const base = { ...h, plannedPurchases: [{ ...purchase, allowanceId }] };
  const html = renderToStaticMarkup(<ForecastPage h={base} sc={{ contribution: 0 }} />);
  expect(row(html, 'Planned purchases (extra)')).toContain(allowanceId ? '$0' : '$200');
  expect(row(html, 'Total expected spending')).toContain(allowanceId ? '$3,092' : '$3,292');
});

it('shows remaining-month costs rather than a full-month baseline in the current-month column', () => {
  const outlook = monthlyOutlook(h, { contribution: 0 }, '2026-09');
  const html = renderToStaticMarkup(<MonthsCompare evidence={evidence} forecastMonth="2026-09" outlook={outlook} />);
  expect(html).toContain('remaining');
  expect(row(html, 'Groceries')).toContain('$489.60');
  expect(row(html, 'Total expected spending')).toContain(budgetMoney(outlook.spending));
  expect(row(html, 'Total expected spending')).not.toContain('$3,092');
});

it('still shows bills and the correct total when category history is missing', () => {
  const html = renderToStaticMarkup(<ForecastPage h={{ ...h, allowances: [], spendingEvidence: undefined }} sc={{ contribution: 0 }} />);
  expect(row(html, 'Total expected spending')).toContain('$1,593');
  expect(html).toContain('mc-table');
});

it('does not label unprovided historical bill totals as zero', () => {
  const html = renderToStaticMarkup(<ForecastPage h={h} sc={{ contribution: 0 }} />);
  const bills = row(html, 'Rent &amp; other bills');
  expect(bills).toContain('Not included in this history');
  expect(bills).not.toContain('$0');
});

