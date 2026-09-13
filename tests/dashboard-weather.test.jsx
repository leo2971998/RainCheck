import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../src/pages/Dashboard.jsx';
import { household as sample } from '../data/household.sample.js';
import { simulate } from '../src/engine/forecast.js';
import { weeklyBudget } from '../src/engine/weekly-budget.js';
import { Outlook } from '../src/components/Weather.jsx';
const h = { ...sample, today: '2026-09-28', checking: 1260, cushion: 200, spendingModel: null,
  spendingPeriod: 'calendar-month', allowances: [{ id: 'food', label: 'Food', monthly: 1500 }],
  recurring: [{ id: 'rent', label: 'Rent', amount: 1200, day: 15 }], income: [], activity: null };

function render(alerts, extra = {}) {
  const sc = { contribution: 0 };
  return renderToStaticMarkup(<Dashboard h={h} sc={sc} alerts={alerts} open={() => {}} {...extra} />);
}
function currentIcon(html) {
  return html.match(/class="sky-icon on"><svg[^>]*class="wx wx-([^"]+)"/)?.[1];
}

it('adds rain when an open alert needs review', () => {
  expect(currentIcon(render([{ tone: 'warn' }]))).toBe('rain');
});
it('does not mistake alert severity for a negative checking balance', () => {
  expect(currentIcon(render([{ tone: 'good' }, { tone: 'bad' }]))).toBe('rain');
});
it('shows rain when this week needs reserved money even without an alert label', () => {
  const hh = { ...h, checking: 500, income: [], recurring: [], cushion: 200 };
  const sc = { contribution: 100, contributionDates: [h.today] };
  const w = weeklyBudget(hh, sc);
  expect(w.state).toBe('below');
  const html = render([], { h: hh, sc });
  expect(currentIcon(html)).toBe('rain');
  expect(html).toContain('ambient contained raining');
  expect(html).toContain('more planned than available');
  expect(html).toContain('protect bills and savings');
  expect(html).not.toContain('not your bank balance');
  expect(html).toContain('Review this week');
});
it('shows a storm when this week cannot cover spending even if alerts were cleared', () => {
  const hh = { ...h, checking: 100, income: [], recurring: [] };
  expect(weeklyBudget(hh, { contribution: 0 }).state).toBe('over');
  const html = render([{ tone: 'good' }], { h: hh });
  expect(currentIcon(html)).toBe('storm');
  expect(html).toContain('ambient contained raining storm');
  expect(html).toContain('Bills and spending need an adjustment.');
  expect(html).toContain('Review this week');
});
it('keeps a later forecast shortfall from changing this week’s weather', () => {
  expect(simulate(h, { contribution: 550 }).worst).toBe('over');
  const html = render([]);
  expect(currentIcon(html)).toBe('sun');
  expect(html).not.toContain('contained raining');
  expect(html).not.toContain('Review this week');
});
it('clears the hero for confirmations and does not cloud it for routine reminders', () => {
  expect(currentIcon(render([{ tone: 'good' }], { reminders: [{ label: 'Internet', when: 'tomorrow', amount: 75 }] }))).toBe('sun');
});
it('uses the selected appearance for the hero sky', () => {
  const clearHousehold = { ...h, checking: 5_000, income: [], recurring: [], allowances: [], purchases: [] };
  const light = render([], { h: clearHousehold, dark: false });
  const dark = render([], { h: clearHousehold, dark: true });
  expect(light).toContain('weekly-hero sky-day');
  expect(currentIcon(light)).toBe('sun');
  expect(dark).toContain('weekly-hero sky-night');
  expect(currentIcon(dark)).toBe('moon');
});
it('keeps the moonlit atmosphere when the dark theme needs rain', () => {
  const clearHousehold = { ...h, checking: 5_000, income: [], recurring: [], allowances: [], purchases: [] };
  const weekly = { ...weeklyBudget(clearHousehold, { contribution: 0 }), state: 'below', shortfall: 25 };
  const html = render([], { h: clearHousehold, weekly, dark: true });
  expect(currentIcon(html)).toBe('rain-night');
  expect(html).toContain('weekly-hero sky-night');
  expect(html).toContain('ambient contained raining');
});
it('keeps purchase planning without duplicating the global chat launcher', () => {
  const html = render([]);
  expect(html).toContain('Plan a purchase');
  expect(html).not.toContain('Ask RainCheck');
  expect(html).not.toContain('Nessie');
  expect(html).not.toContain('sandbox');
  expect(html).not.toContain('Lowest projected balance');
  expect(html).not.toContain('Edit checking target');
  expect(html).not.toContain('Keep in checking:');
});
it('keeps detailed recommendations out of the hero and offers one review action', () => {
  const html = render([], { h: { ...h, checking: 500, income: [], recurring: [] },
    sc: { contribution: 100, contributionDates: [h.today] } });
  expect(html).not.toContain('hero-fixes');
  expect(html).not.toContain('Ways to handle it, easiest first');
  expect(html.match(/Review this week/g)).toHaveLength(1);
  expect(html).toContain('weekly-warning');
});
it('puts clickable widgets after the weekly amount instead of a five-week forecast', () => {
  const html = render([]);
  expect(html.indexOf('Left to spend this week')).toBeLessThan(html.indexOf('class="today-widgets"'));
  expect(html).not.toContain('The next five weeks');
  expect(html).not.toContain('Projected checking balance');
  expect(html).not.toContain('Elsewhere in RainCheck');
});
it('shows a dated checking amount and keeps its explanation inside a closed disclosure', () => {
  const days = [
    { date: new Date('2026-10-10T12:00:00'), state: 'ok', balance: 700 },
    { date: new Date('2026-10-11T12:00:00'), state: 'ok', balance: 485 },
  ];
  const html = renderToStaticMarkup(<Outlook sim={{ days }} h={h} />);
  expect(html).toContain('Each card shows the least money expected in checking');
  expect(html).toContain('Room to spare');
  expect(html).toContain('Over $200');
  expect(html).toMatch(/<details[^>]*><summary[^>]*>What’s included\?<\/summary>/);
  expect(html).not.toMatch(/<details[^>]*\bopen/);
  expect(html).toContain('Checking could drop to');
  expect(html.includes('expected income, bills, spending and planned savings')).toBe(true);
  expect(html.includes('$485')).toBe(true);
  expect(html.includes('on Oct 11')).toBe(true);
  expect(html.includes('low $485')).toBe(false);
});

it.each([
  [300, 'ok', 'Room to spare', 'Over $200', 'sun'],
  [250, 'tight', 'Little room left', 'Just over $200', 'partly'],
  [200, 'tight', 'Little room left', 'At $200', 'partly'],
  [175, 'below', 'Getting tight', 'Under $200', 'rain'],
  [0, 'below', 'Getting tight', 'Under $200', 'rain'],
  [-50, 'over', 'Short of money', 'Under $0', 'storm'],
])('keeps the weekly label and weather consistent for a %s balance', (balance, state, label, threshold, icon) => {
  const sim = { days: [{ date: new Date('2026-10-11T12:00:00'), balance, state }] };
  const html = renderToStaticMarkup(<Outlook sim={sim} h={h} />);
  expect(html).toContain(label);
  expect(html).toContain(threshold);
  expect(html).toContain(`class="wx wx-${icon}"`);
  expect(html).not.toContain('Below cushion');
});

it('uses the household checking target instead of hardcoding the example amount', () => {
  const sim = { days: [{ date: new Date('2026-10-11T12:00:00'), balance: 475, state: 'below' }] };
  const html = renderToStaticMarkup(<Outlook sim={sim} h={{ ...h, cushion: 500 }} />);
  expect(html).toContain('Under $500');
  expect(html).not.toContain('$200');
  const cents = renderToStaticMarkup(<Outlook sim={sim} h={{ ...h, cushion: 500.25 }} />);
  expect(cents).toContain('Under $500.25');
});
