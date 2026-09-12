import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../src/pages/Dashboard.jsx';
import { household as h } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { simulate, goalAt } from '../src/engine/forecast.js';

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
it('shows stormy weather for a severe alert ahead of positive confirmations', () => {
  expect(currentIcon(render([{ tone: 'good' }, { tone: 'bad' }]))).toBe('storm');
});
it('clears the hero for confirmations and does not cloud it for routine reminders', () => {
  expect(currentIcon(render([{ tone: 'good' }], { reminders: [{ label: 'Internet', when: 'tomorrow', amount: 75 }] }))).toBe('sun');
});
it('does not equate the dark appearance preference with nighttime', () => {
  const html = render([], { dark: true });
  expect(html).toContain('weather-hero sky-day');
  expect(currentIcon(html)).toBe('sun');
});
it('preserves purchase planning and AI review entry points alongside the new weather', () => {
  const html = render([]);
  expect(html).toContain('Plan a purchase');
  expect(html).toContain('Talk through my plan');
  expect(html).toContain('Lowest projected balance');
});
