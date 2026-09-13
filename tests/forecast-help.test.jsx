import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { household as base } from '../data/household.sample.js';
import { simulate, round2 } from '../src/engine/forecast.js';
import ForecastHelpDrawer, { checkingBreakdown } from '../src/drawers/ForecastHelpDrawer.jsx';
import CompareDrawer from '../src/drawers/CompareDrawer.jsx';
import { capacity } from '../src/engine/forecast.js';
import { buildOptions, currentOutcome } from '../src/engine/options.js';
import { emptyPlan, householdFor, scenarioFor, applyPatch } from '../src/engine/plan.js';
import { rainDemoPatch } from '../src/engine/rain-demo.js';
import { calculateReview, householdVersion } from '../api/_review.js';

it('explains the warning using all forecast events up to the lowest day', () => {
  const h = { ...base, cushion: 350 }, sim = simulate(h, { contribution: 300 });
  const rows = checkingBreakdown(h, sim);
  expect(round2(rows.reduce((sum, row) => sum + row.amount, 0))).toBe(sim.low.balance);
  expect(rows.find(row => row.label === 'Monthly goal savings').amount).toBe(-300);
  const html = renderToStaticMarkup(<ForecastHelpDrawer h={h} sim={sim} open={() => {}} onClose={() => {}} />);
  for (const text of ['$150', '$350', 'Check the numbers', 'Expected income', 'Compare adjustments'])
    expect(html.includes(text)).toBe(true);
  expect(html).not.toContain('No money moves');
});
it('keeps a negative balance warning distinct from the checking target', () => {
  const sim = simulate(base, { contribution: 550 });
  const html = renderToStaticMarkup(<ForecastHelpDrawer h={base} sim={sim} open={() => {}} onClose={() => {}} />);
  expect(html.includes('below $0')).toBe(true);
  expect(html.includes('$50')).toBe(true);
});
it('does not promise that an unaffordable adjustment resolves the warning', () => {
  const h = { ...base, cushion: 5000 }, sc = { contribution: 300 };
  const protectedIds = Object.fromEntries(h.allowances.map(a => [a.id, true]));
  const cap = capacity(h, sc), options = buildOptions(h, sc, cap, protectedIds);
  const html = renderToStaticMarkup(<CompareDrawer h={h} sc={sc} cap={cap} options={options}
    current={currentOutcome(h, sc)} protectedIds={protectedIds} onClose={() => {}} />);
  expect(html.includes('None of these changes fully protects')).toBe(true);
  expect(html.includes('Still below your')).toBe(true);
  expect(html).not.toContain('Nothing changes until you apply');
});
it('discloses the savings assumption behind a conditional cancellation preview', () => {
  const h = { ...base, cushion: 350 }, sc = { contribution: 300 };
  const cap = capacity(h, sc), options = buildOptions(h, sc, cap, {});
  const html = renderToStaticMarkup(<CompareDrawer h={h} sc={sc} cap={cap} options={options}
    current={currentOutcome(h, sc)} protectedIds={{}} onClose={() => {}} />);
  expect(html.includes('This preview also assumes $190/month in savings.')).toBe(true);
});

it('offers a calculator-checked rainy-day preview without applying it or lowering the target', () => {
  const plan = applyPatch(emptyPlan(), rainDemoPatch(base, emptyPlan())).plan;
  const h = householdFor(base, plan), sc = scenarioFor(h, plan), sim = simulate(h, sc);
  const options = buildOptions(h, sc, capacity(h, sc));
  const html = renderToStaticMarkup(<ForecastHelpDrawer h={h} sc={sc} sim={sim} options={options}
    current={currentOutcome(h, sc)} plan={plan} baseVersion={householdVersion(base)} open={() => {}} onClose={() => {}} />);
  for (const text of ['One option: save less for now', '$300', '$275', '$175', '$200', '$1,900', '$100 short', 'Ask AI about this option', 'Preview only'])
    expect(html).toContain(text);
  const result = calculateReview(base, { consent: true, baseVersion: householdVersion(base), plan,
    patch: { contribution: 275 }, kind: 'plan', question: 'Explain this rainy-day preview.' });
  expect(result.before.low).toBe(175);
  expect(result.after.low).toBe(200);
  expect(result.after.cushion).toBe(200);
  expect(simulate(h, sc).worst).toBe('below');
});

it('does not offer a savings-only fix when even no savings leaves a shortfall', () => {
  const h = { ...base, cushion: 5000 }, sc = { contribution: 300 }, sim = simulate(h, sc);
  const options = buildOptions(h, sc, capacity(h, sc), Object.fromEntries(h.allowances.map(a => [a.id, true])));
  const html = renderToStaticMarkup(<ForecastHelpDrawer h={h} sc={sc} sim={sim} options={options}
    current={currentOutcome(h, sc)} open={() => {}} onClose={() => {}} />);
  expect(html).toContain('Saving less alone does not close this gap');
  expect(html).not.toContain('One option: save less for now');
});
