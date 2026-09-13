import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../src/pages/Dashboard.jsx';
import { household as h } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { simulate, goalAt } from '../src/engine/forecast.js';
import { Outlook } from '../src/components/Weather.jsx';

function render(alerts, extra = {}) {
  const sc = { contribution: 0 };
  return renderToStaticMarkup(<Dashboard h={h} source="sample" plan={emptyPlan()} sc={sc}
    sim={{ ...simulate(h, sc), worst: 'ok' }} cap={0} goal={{ ...goalAt(h, 0), fits: true }}
    alerts={alerts} open={() => {}} {...extra} />);
}
function currentIcon(html) {
  return html.match(/class="sky-icon on"><svg[^>]*class="wx wx-([^"]+)"/)?.[1];
}

it('shows partly cloudy for a warning even when the balance forecast is clear', () => {
  expect(currentIcon(render([{ tone: 'warn' }]))).toBe('partly');
});
it('does not mistake alert severity for a negative checking balance', () => {
  expect(currentIcon(render([{ tone: 'good' }, { tone: 'bad' }]))).toBe('partly');
});
it('shows rain below the cushion even without an alert label', () => {
  const sim = simulate(h, { contribution: 325 });
  expect(sim.worst).toBe('below');
  const html = render([], { sim });
  expect(currentIcon(html)).toBe('rain');
  expect(html).toContain('ambient contained raining');
  expect(html).toContain('Rain forecast');
  expect(html).toContain('Your plan could leave just $175 in checking.');
  expect(html).toContain('for unexpected costs');
  expect(html).toContain('$25 less than');
  expect(html).toContain('not your current balance');
  expect(html).toContain('Review my plan');
});
it('shows a storm for a negative forecast even if alerts were cleared', () => {
  const sim = simulate(h, { contribution: 550 });
  expect(sim.worst).toBe('over');
  const html = render([{ tone: 'good' }], { sim });
  expect(currentIcon(html)).toBe('storm');
  expect(html).toContain('ambient contained raining storm');
  expect(html).toContain('Storm forecast');
  expect(html).toContain('Your plan could leave checking $50 short.');
  expect(html).toContain('Review my plan');
});
it('clears rain only after the forecast recovers', () => {
  const html = render([], { sim: simulate(h, { contribution: 0 }) });
  expect(currentIcon(html)).toBe('sun');
  expect(html).not.toContain('contained raining');
  expect(html).not.toContain('Review my plan');
});
it('clears the hero for confirmations and does not cloud it for routine reminders', () => {
  expect(currentIcon(render([{ tone: 'good' }], { reminders: [{ label: 'Internet', when: 'tomorrow', amount: 75 }] }))).toBe('sun');
});
it('does not equate the dark appearance preference with nighttime', () => {
  const html = render([], { dark: true });
  expect(html).toContain('weather-hero sky-day');
  expect(currentIcon(html)).toBe('sun');
});
it('keeps purchase planning without duplicating the global chat launcher', () => {
  const html = render([]);
  expect(html).toContain('Plan a purchase');
  expect(html).not.toContain('Ask RainCheck');
  expect(html).not.toContain('Nessie');
  expect(html).not.toContain('sandbox');
  expect(html).toContain('Lowest projected balance');
  expect(html).not.toContain('Edit checking target');
  expect(html).not.toContain('Keep in checking:');
});
it('puts navigation and purchase planning before the weekly forecast', () => {
  const html = render([]);
  expect(html.indexOf('class="peeks"')).toBeLessThan(html.indexOf('The next five weeks'));
  expect(html.indexOf('Plan a purchase')).toBeLessThan(html.indexOf('The next five weeks'));
  expect(html).not.toContain('Elsewhere in RainCheck');
});
it('keeps the checking target short and puts the dated balance inside a closed disclosure', () => {
  const days = [
    { date: new Date('2026-10-10T12:00:00'), state: 'ok', balance: 700 },
    { date: new Date('2026-10-11T12:00:00'), state: 'ok', balance: 485 },
  ];
  const html = renderToStaticMarkup(<Outlook sim={{ days }} h={h} />);
  expect(html).toContain('Weekly balance estimates');
  expect(html).toContain('Above target');
  expect(html).toContain('Over $200');
  expect(html).toMatch(/<details[^>]*><summary[^>]*>View estimate<\/summary>/);
  expect(html).not.toMatch(/<details[^>]*\bopen/);
  expect(html).toContain('Checking could drop to');
  expect(html.includes('expected income, bills, spending and planned savings')).toBe(true);
  expect(html.includes('$485')).toBe(true);
  expect(html.includes('on Oct 11')).toBe(true);
  expect(html.includes('low $485')).toBe(false);
});

it.each([
  [300, 'ok', 'Above target', 'Over $200', 'sun'],
  [250, 'tight', 'Near target', 'Just over $200', 'partly'],
  [200, 'tight', 'Near target', 'At $200', 'partly'],
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
