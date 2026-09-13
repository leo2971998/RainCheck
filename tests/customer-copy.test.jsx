import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../src/pages/Dashboard.jsx';
import AlertsPage from '../src/pages/AlertsPage.jsx';
import MonthsCompare from '../src/components/MonthsCompare.jsx';
import SavingsPlanner from '../src/drawers/SavingsPlanner.jsx';
import { household as base } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';

it('keeps Today focused on the spending amount and action', () => {
  const html = renderToStaticMarkup(<Dashboard h={base} sc={{}} open={() => {}} />);
  expect(html).toContain('Left to spend this week');
  expect(html).not.toContain('Weekly estimate · not your bank balance');
});
it('keeps alert mechanics out of the customer copy', () => {
  const html = renderToStaticMarkup(<AlertsPage h={base} sc={emptyPlan()} alerts={[]} reminders={[]} open={() => {}} />);
  expect(html).not.toContain('One event, one alert');
  expect(html).not.toContain('Spending trends go');
});
it('shows the monthly comparison without the methodology paragraph', () => {
  const evidence = { months: [{ key: '2026-08', partial: false }], categories: [{ id: 'food', label: 'Food', total: 200, monthly: 200, months: [{ key: '2026-08', total: 200 }] }] };
  const html = renderToStaticMarkup(<MonthsCompare evidence={evidence} forecastMonth="2026-09" />);
  expect(html).toContain('Every month on record');
  expect(html).toContain('$200');
  expect(html).not.toContain('middle of the complete months');
});
it('shows the AI explanation without process badges and boilerplate', () => {
  const optimization = { status: 'ready', data: { review: { status: 'complete', result: { summary: 'A smaller dining limit leaves room for your trip.' } },
    optimization: { draft: { targets: Object.fromEntries(base.allowances.map(a => [a.id, a.monthly])), extras: {} } } } };
  const html = renderToStaticMarkup(<SavingsPlanner optimization={optimization} base={base} plan={emptyPlan()} onClose={() => {}} />);
  expect(html).toContain('Why these limits');
  expect(html).toContain('A smaller dining limit leaves room for your trip.');
  expect(html).not.toContain('AI review complete');
  expect(html).not.toContain('AI reviewed starting limits');
});
