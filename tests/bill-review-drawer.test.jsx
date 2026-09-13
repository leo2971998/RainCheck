import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BillReviewDrawer from '../src/drawers/BillReviewDrawer.jsx';
import { household as h } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
const bill = h.recurring.find(r => r.unexplained);
it('shows charge evidence, a forecast estimate, next step and private notes without inventing a notice', () => {
  const html = renderToStaticMarkup(<BillReviewDrawer id={bill.id} h={h} plan={emptyPlan()} notes={{}} change={() => {}} saveNote={() => {}} onClose={() => {}} />);
  for (const text of ['Review Electric charge', 'What the bank recorded', '$128', '$108',
    'Future bill estimate', 'Ask the company', 'Your notes', 'Save review', 'not sent to AI']) expect(html).toContain(text);
  expect(html.includes('promotional credit')).toBe(false);
  expect(html.includes('Paste the notice')).toBe(false);
});
it('handles a removed or unavailable bill without exposing raw identifiers', () => {
  const html = renderToStaticMarkup(<BillReviewDrawer id="missing-internal-id" h={h} plan={emptyPlan()} notes={{}} onClose={() => {}} />);
  expect(html).toContain('This bill is no longer available');
  expect(html.includes('missing-internal-id')).toBe(false);
});
