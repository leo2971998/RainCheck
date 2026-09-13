import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../src/pages/Dashboard.jsx';
import { forecastWeather } from '../src/components/Weather.jsx';
import { weeklyBudget } from '../src/engine/weekly-budget.js';
import { buildAlerts } from '../src/engine/alerts.js';

const h = { today: '2026-09-13', checking: 515, savings: 800, cushion: 200, windowDays: 34,
  spendingPeriod: 'calendar-month', allowances: [{ id: 'food', label: 'Food', monthly: 1499 }],
  recurring: [], income: [], goal: { label: 'Emergency fund', target: 2000, saved: 800, planned: 300 },
  activity: { asOf: '2026-09-13', week: { spent: 1105 }, month: { income: 1800, spent: 2935 } } };
const sc = { contribution: 0 };
it('keeps a recorded overspend rainy even when the remaining budget is clamped to zero', () => {
  expect(weeklyBudget(h, sc)).toMatchObject({ budget: 349.77, overspent: 755.23, available: 0, shortfall: 0, state: 'below' });
  expect(weeklyBudget({ ...h, checking: -10 }, sc).state).toBe('over');
});
it('open alerts trigger rain, while only a cash shortage triggers a storm', () => {
  expect(forecastWeather('ok', [{ tone: 'warn' }])).toBe('below');
  expect(forecastWeather('tight', [{ tone: 'bad' }])).toBe('below');
  expect(forecastWeather('over', [{ tone: 'warn' }])).toBe('over');
  expect(forecastWeather('ok', [{ tone: 'good' }])).toBe('ok');
});
it('keeps weekly and monthly overspending out of the alert queue', () => {
  const alerts = buildAlerts(h, sc, { worst: 'ok' }, 0, null, { gap: 0, fits: true });
  expect(alerts).toEqual([]);
  const monthlyOnly = { ...h, activity: { ...h.activity, week: { spent: 10 } } };
  expect(buildAlerts(monthlyOnly, sc, { worst: 'ok' }, 0, null, { gap: 0, fits: true })).toEqual([]);
});
it('still shows Today rain and spending warnings without adding a review alert', () => {
  const html = renderToStaticMarkup(<Dashboard h={h} sc={sc} alerts={[]} open={() => {}} dark />);
  expect(html).toContain('data-weather="below"');
  expect(html).toContain('ambient contained raining');
  expect(html).toContain('$755.23');
  expect(html).toContain('Review spending &amp; savings');
  expect(html).toContain('today-widget is-warning');
  expect(html).not.toContain('alerts to review');
});
it.each([false, true])('shows visible warnings, alert count, recovery action and rain in dark=%s', dark => {
  const html = renderToStaticMarkup(<Dashboard h={h} sc={sc} alerts={[{ tone: 'warn' }, { tone: 'bad' }]} open={() => {}} dark={dark} />);
  expect(html).toContain('data-weather="below"');
  expect(html).toContain('ambient contained raining');
  expect(html).toContain('2 alerts to review');
  expect(html).toContain('Review spending &amp; savings');
  expect(html).toContain('today-widget is-warning');
  expect(html).toContain('Spending exceeds income received');
  expect(html).not.toContain('After setting room aside');
});
it('does not treat missing current activity as zero income or an overspend', () => {
  const old = { ...h, activity: { ...h.activity, asOf: '2026-09-12' } };
  expect(weeklyBudget(old, sc)).toMatchObject({ spent: null, month: null, overspent: 0 });
});
