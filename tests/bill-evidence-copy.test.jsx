import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { household as base } from '../data/household.sample.js';
import { emptyPlan, householdFor, scenarioFor } from '../src/engine/plan.js';
import { simulate, capacity } from '../src/engine/forecast.js';
import { buildAlerts } from '../src/engine/alerts.js';
import BillDrawer from '../src/drawers/BillDrawer.jsx';
import BillReviewDrawer from '../src/drawers/BillReviewDrawer.jsx';

const plan = { ...emptyPlan(), billChanges: { internet: {
  to: 90, increase: 25, effective: '2026-10-01', why: 'Promotional credit ended', support: 'support.northline.example',
} } };

it('does not turn an old saved estimate into a company statement or a posted payment', () => {
  const h = householdFor(base, plan), sc = scenarioFor(h, plan);
  const html = renderToStaticMarkup(<BillDrawer h={h} plan={plan} notice="" billId="internet" cap={capacity(h, sc)} />);
  for (const text of ['Saved forecast estimate', 'Northline Internet', '$65', '$90', 'Contact the company', 'Your notes'])
    expect(html).toContain(text);
  for (const text of ['Promotional credit ended', 'Confirmed from a notice', 'support.northline.example', 'A price change, not higher usage'])
    expect(html).not.toContain(text);
  expect(html).toContain('not a recorded payment');
  const alert = buildAlerts(h, sc, simulate(h, sc), capacity(h, sc)).find(a => a.id === 'increase:internet');
  expect(alert.title).toContain('estimate');
  expect(alert.title).not.toContain('bill increased');
});

it.each([[128, 'higher'], [80, 'lower']])('shows the recorded company and signed payment difference for %s', (amount, direction) => {
  const h = { ...base, recurring: base.recurring.map(r => r.id === 'electric' ? { ...r, lastPosted: amount } : r) };
  const html = renderToStaticMarkup(<BillReviewDrawer id="electric" h={h} plan={emptyPlan()} notes={{}} />);
  expect(html).toContain('Reliant Energy');
  expect(html).toContain(direction);
  expect(html.indexOf('Your notes')).toBeLessThan(html.indexOf('Future bill estimate'));
  expect(html).toMatch(/<details[^>]*><summary>Update the forecast estimate<\/summary>/);
  expect(html).not.toContain('Promotional credit ended');
});
