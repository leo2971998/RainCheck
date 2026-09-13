import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ForecastPage from '../src/pages/ForecastPage.jsx';
import PurchasesPage from '../src/pages/PurchasesPage.jsx';
import GoalContext from '../src/components/GoalContext.jsx';
import PurchaseDrawer, { purchaseSaveToast } from '../src/drawers/PurchaseDrawer.jsx';
import { household as base } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { simulate } from '../src/engine/forecast.js';

it('counts a purchase in the monthly forecast even when its name starts with Everyday', () => {
  const h = { ...base, spendingPeriod: 'calendar-month', plannedPurchases: [{ id: 'test', label: 'Everyday laptop', date: '2026-10-12', amount: 123.45, status: 'planned' }] };
  const sc = { contribution: 0 };
  const html = renderToStaticMarkup(<ForecastPage h={h} sim={simulate(h,sc)} sc={sc} cap={0} plan={emptyPlan()} change={() => {}} />);
  expect(html).toContain('$3,183.45');
});
it('keeps completed purchase history and bank reference IDs off the calendar', () => {
  const h = { ...base, plannedPurchases: [{ id: 'internal-id', label: 'Concert tickets', actualDate: base.today, actualAmount: 200, status: 'completed', transactionId: 'purchase:internal-reference' }] };
  const html = renderToStaticMarkup(<PurchasesPage h={h} available open={() => {}} refresh={() => {}} />);
  expect(html).not.toContain('Completed &amp; removed'); expect(html).not.toContain('Matched to a posted charge');
  expect(html).not.toContain('internal-reference'); expect(html).not.toContain('internal-id'); expect(html).not.toContain('Concert tickets');
});

it('keeps the four-step workflow in the purchase form instead of repeating it above the calendar', () => {
  const pageHtml = renderToStaticMarkup(<PurchasesPage h={{ ...base, plannedPurchases: [] }} available open={() => {}} refresh={() => {}} />);
  const html = renderToStaticMarkup(<PurchaseDrawer initialDate={base.today} base={base} baseVersion="version" plan={emptyPlan()} refresh={() => {}} onClose={() => {}} />);
  expect(html).toContain('aria-label="Purchase planning steps"');
  for (const text of ['Add purchase details', 'Check your budget', 'Review with AI', 'Save to your plan']) expect(html).toContain(text);
  expect(html).toContain('Optional');
  expect(pageHtml).not.toContain('How purchase planning works');
  expect(html).not.toContain('What creates an alert?');
  expect(html).not.toContain('1 · Enter a cost and date');
});

it('shows useful purchase totals above the calendar instead of setup instructions', () => {
  const h = { ...base, plannedPurchases: [
    { id: 'concert', label: 'Concert tickets', date: '2026-09-29', amount: 200, status: 'planned' },
    { id: 'trip', label: 'Weekend trip', date: '2026-10-08', amount: 450, status: 'planned' },
  ] };
  const html = renderToStaticMarkup(<PurchasesPage h={h} available open={() => {}} refresh={() => {}} />);
  for (const text of ['Purchase overview', '2 planned', '$650', 'Next purchase', 'Concert tickets', 'Sep 29']) expect(html).toContain(text);
});

it('does not ask for a separate merchant name when planning a purchase', () => {
  const html = renderToStaticMarkup(<PurchaseDrawer initialDate={base.today} base={base} baseVersion="version" plan={emptyPlan()} refresh={() => {}} onClose={() => {}} />);
  expect(html).not.toContain('Merchant for matching');
  expect(html).not.toContain('Merchant name');
  expect(html).toContain('How should we count it?');
});

it('shows only the selected month as a calendar with purchases on their dates', () => {
  const h = { ...base, plannedPurchases: [
    { id: 'september', label: 'Concert tickets', date: '2026-09-29', amount: 200, status: 'planned' },
    { id: 'october', label: 'Weekend trip', date: '2026-10-08', amount: 450, status: 'planned' },
  ] };
  const html = renderToStaticMarkup(<PurchasesPage h={h} available open={() => {}} refresh={() => {}} />);
  for (const text of ['September 2026', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Concert tickets', '$200', 'Add purchase on Sep 28']) expect(html).toContain(text);
  expect(html).toContain('class="purchase-calendar-cell-action"');
  expect(html).toContain('aria-label="Add purchase on Sep 29"');
  expect(html).toContain('aria-label="Edit Concert tickets"');
  expect(html).toContain('purchase-calendar-cell today');
  expect(html).not.toContain('purchase-calendar-cell selected');
  expect(html).not.toContain('aria-pressed=');
  expect(html).not.toContain('Selected day');
  expect(html).not.toContain('No purchase is planned on this day');
  for (const text of ['Weekend trip', 'Coming up', '0 planned', 'A little planning, fewer surprises', 'Forecast date:', 'Refresh purchases']) expect(html).not.toContain(text);
});

it('does not show the connected-goal strip above Purchases', () => {
  const html = renderToStaticMarkup(<GoalContext page="purchases" h={base} goal={{ fits: true, gap: 0, contribution: 300, targetDate: '2027-01-02' }} open={() => {}} />);
  expect(html).toBe('');
});

it('opens the purchase form on the day chosen in the calendar', () => {
  const html = renderToStaticMarkup(<PurchaseDrawer initialDate="2026-10-12" base={base} baseVersion="version" plan={emptyPlan()} refresh={() => {}} onClose={() => {}} />);
  expect(html).toContain('value="2026-10-12"');
});

it('offers a direct alert link only when the saved purchase needs attention', () => {
  let opened = false;
  const warning = purchaseSaveToast({ status: { tone: 'warn' }, previewMonth: 'October 2026', onOpenAlerts: () => { opened = true; } });
  expect(warning.title).toBe('October 2026 budget alert added');
  expect(warning.actions[0].label).toBe('Review alert');
  warning.actions[0].run();
  expect(opened).toBe(true);
  expect(purchaseSaveToast({ status: { tone: 'good' }, previewMonth: 'October 2026' }).actions).toEqual([]);
});
