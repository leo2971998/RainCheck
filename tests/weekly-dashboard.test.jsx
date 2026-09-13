import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../src/pages/Dashboard.jsx';
import WeeklyBudgetDrawer from '../src/drawers/WeeklyBudgetDrawer.jsx';
import { household as sample } from '../data/household.sample.js';
import snapshot from '../data/nessie-snapshot.json';
import { activitySummary, weeklyBudget } from '../src/engine/weekly-budget.js';
import { simulate } from '../src/engine/forecast.js';

const h = { ...sample, activity: activitySummary(snapshot, sample.today) };
const sc = { contribution: 300 };
const render = (facts = h, scenario = sc, extra = {}) => renderToStaticMarkup(<Dashboard h={facts} sc={scenario}
  sim={simulate(facts, scenario)} goal={{ ...facts.goal, projected: 2000, fits: true }} alerts={[]} open={() => {}} {...extra} />);

it('leads with one weekly spending amount and removes the dense forecasting panels', () => {
  const html = render();
  expect(html).toContain('Left to spend this week');
  expect(html).toContain('Sep 28 – Oct 4');
  expect(html).toContain('View weekly budget');
  for (const text of ['The next five weeks', 'Lowest projected balance', 'Supported saving', 'Projected checking balance',
    'Bill changes &amp; reviews', 'Why could checking', 'See next month', 'Oct 15', 'Ask RainCheck']) expect(html).not.toContain(text);
});
it('offers real clickable widgets with recorded income, spending and a distinct checking balance', () => {
  const html = render();
  expect(html.match(/class="today-widget"/g)).toHaveLength(6);
  for (const text of ['Money this month', 'This week’s bills', 'Next income', 'Savings', 'Alerts', 'Planned purchases',
    '$3,078', '$3,400', '$1,260', 'View transactions']) expect(html).toContain(text);
  for (const text of ['Open to see what needs attention', 'No open budget alerts', 'Try a purchase before committing']) expect(html).not.toContain(text);
});
it('shows one shared savings total and goal names, without reallocating savings', () => {
  const facts = { ...h, fundedGoals: [{ id: 'emergency', label: 'Emergency fund', target: 2000, saved: 800, planned: 300, targetDate: '2027-01-02' },
    { id: 'concert', label: 'Concert', target: 500, saved: 0, planned: 50, targetDate: '2027-02-02' }] };
  const before = JSON.stringify(facts);
  const html = render(facts);
  for (const text of ['2 goals', 'Emergency fund', 'Concert', '$800', '$2,500', '32%']) expect(html).toContain(text);
  expect(html).not.toContain('Concert: $0');
  expect(JSON.stringify(facts)).toBe(before);
});
it('adds rain when an alert needs review without claiming this week is overdrawn', () => {
  const facts = { ...h, plannedPurchases: [{ id: 'later', label: 'Later concert', amount: 5000, date: '2026-10-15', status: 'planned' }] };
  const html = render(facts, sc, { alerts: [{ tone: 'bad' }] });
  expect(simulate(facts, sc).worst).toBe('over');
  expect(html).toContain('data-weather="below"');
  expect(html).toContain('contained raining');
});
it('shows the amount that exceeds this week’s available budget, with an action', () => {
  const initial = weeklyBudget(h, sc);
  const facts = { ...h, checking: h.checking - (initial.room - initial.remainingBudget + 25) };
  const html = render(facts);
  expect(html).toContain('data-weather="below"');
  expect(html).toContain('$25 more planned than available');
  expect(html).toContain('Review spending &amp; savings');
});
it('keeps the explanation and adjustment links in the weekly detail panel', () => {
  const weekly = weeklyBudget(h, sc);
  const html = renderToStaticMarkup(<WeeklyBudgetDrawer h={h} weekly={weekly} open={() => {}} onClose={() => {}} />);
  for (const text of ['role="dialog"', 'Your weekly budget', 'Already spent this week', 'Upcoming bills this week',
    'Goal savings planned this week', 'Review planned purchases', 'Review savings plan', 'Review bills']) expect(html).toContain(text);
  expect(html).not.toContain('No money moves');
  const withoutHistory = renderToStaticMarkup(<WeeklyBudgetDrawer h={h} weekly={{ ...weekly, spent: null }} open={() => {}} onClose={() => {}} />);
  expect(withoutHistory).toContain('Records unavailable');
});
