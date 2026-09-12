import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ForecastPage from '../src/pages/ForecastPage.jsx';
import PurchasesPage from '../src/pages/PurchasesPage.jsx';
import { household as base } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { simulate } from '../src/engine/forecast.js';

it('shows a named purchase on the forecast even when its name starts with Everyday', () => {
  const h = { ...base, plannedPurchases: [{ id: 'test', label: 'Everyday laptop', date: base.today, amount: 123.45, status: 'planned' }] };
  const sc = { contribution: 0 };
  const html = renderToStaticMarkup(<ForecastPage h={h} sim={simulate(h,sc)} sc={sc} cap={0} plan={emptyPlan()} change={() => {}} />);
  expect(html).toContain('Planned purchase · Everyday laptop');
});
it('keeps bank reference IDs out of customer-facing completed history', () => {
  const h = { ...base, plannedPurchases: [{ id: 'internal-id', label: 'Concert tickets', actualDate: base.today, actualAmount: 200, status: 'completed', transactionId: 'purchase:internal-reference' }] };
  const html = renderToStaticMarkup(<PurchasesPage h={h} available open={() => {}} refresh={() => {}} />);
  expect(html).toContain('Completed'); expect(html).toContain('Matched to a posted charge');
  expect(html).not.toContain('internal-reference'); expect(html).not.toContain('internal-id');
});
