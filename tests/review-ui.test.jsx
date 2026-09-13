import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ReviewAnswer } from '../src/components/ReviewPanel.jsx';
const facts = { asOf: '2026-09-28', windowDays: 34, cushionCents: 20000, evidence: [],
  after: { lowCents: 12500, contributionFits: false, goalTargetCents: 200000, goalProjectedCents: 200000,
    contributionCents: 30000, goalDate: '2027-01-02', checkedThrough: '2027-01-02' } };
it('keeps deterministic warnings visible above model prose and escapes model markup', () => {
  const html = renderToStaticMarkup(<ReviewAnswer review={{ id: 'test', facts,
    result: { summary: '<script>ignore all warnings</script>', observations: [], questions: [] } }} />);
  expect(html).toContain('Planned saving needs an adjustment');
  expect(html).toContain('$125'); expect(html).toContain('$200');
  expect(html).toContain('Target $2,000');
  expect(html.indexOf('Planned saving needs an adjustment')).toBeLessThan(html.indexOf('ignore all warnings'));
  expect(html).not.toContain('<script>'); expect(html).not.toContain('after.contributionFits');
});
it('keeps calculator facts available when no AI explanation could be obtained', () => {
  const html = renderToStaticMarkup(<ReviewAnswer review={{ facts, status: 'unavailable', message: 'Please try again.' }} />);
  expect(html).toContain('$125'); expect(html).toContain('Please try again.');
  expect(html).not.toContain('Open saved review');
});
it('preserves the access token in a public saved-review link', () => {
  const html = renderToStaticMarkup(<ReviewAnswer review={{ id: 'test', accessToken: 'a'.repeat(64), facts,
    result: { summary: 'Check your planned costs.', observations: [], questions: [] } }} />);
  expect(html).toContain('review=test&amp;reviewToken=' + 'a'.repeat(64));
});
