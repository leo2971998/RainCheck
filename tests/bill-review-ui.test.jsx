import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RecurringPage from '../src/pages/RecurringPage.jsx';
import AlertsPage from '../src/pages/AlertsPage.jsx';
import Dashboard from '../src/pages/Dashboard.jsx';
import { household as h } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { billReviewKey, createBillReview } from '../src/engine/bill-reviews.js';
import { simulate, goalAt } from '../src/engine/forecast.js';
import { useHousehold } from '../src/hooks/useHousehold.js';
const bill = h.recurring.find(r => r.unexplained);
const plan = { ...emptyPlan(), treatAsNewPrice: { [bill.id]: false } };
const sc = { ...plan, contribution: 0 };
it('does not count a charge already marked one-time as still needing a decision', () => {
  const html = renderToStaticMarkup(<RecurringPage h={h} sc={sc} plan={plan} cap={0} open={() => {}} />);
  expect(html.includes('Needs a decision')).toBe(false);
  expect(html.includes('No provider notices')).toBe(false);
});
it('uses the same reviewed state in the Alerts summary', () => {
  const html = renderToStaticMarkup(<AlertsPage h={h} sc={sc} alerts={[]} reminders={[]} found open={() => {}} />);
  expect(html.includes('charge needs review')).toBe(false);
});
it('keeps ordinary upcoming bills out of the actionable alert count', () => {
  const html = renderToStaticMarkup(<Dashboard h={h} source="sample" plan={plan} sc={sc} sim={simulate(h,sc)} cap={0}
    goal={{...goalAt(h,0),fits:true}} alerts={[]} reminders={[{label:'Internet',when:'in 3 days',amount:65}]} open={() => {}} />);
  expect(html.includes('1 needs your attention')).toBe(false);
  expect(html).toContain('No open budget alerts');
});
it('starts the sample workspace without an invented provider announcement', () => {
  vi.stubEnv('VITE_DATA_MODE', 'sample');
  function Probe() { const data=useHousehold(); return <span>{data.pendingNotices.length}</span>; }
  expect(renderToStaticMarkup(<Probe />)).toBe('<span>0</span>');
  vi.unstubAllEnvs();
});
it('keeps saved follow-ups and escaped private notes accessible after review', () => {
  const key=billReviewKey(bill), review=createBillReview(bill,{forecastAmount:110,nextStep:'contact'});
  const saved={...emptyPlan(),billReviews:{[key]:review}};
  const html=renderToStaticMarkup(<RecurringPage h={h} sc={saved} plan={saved} billNotes={{[key]:'Ask about usage <script>alert(1)</script>'}} cap={0} open={() => {}} />);
  for (const text of ['Saved follow-ups', 'Ask the company', 'View / edit review', 'Ask about usage &lt;script&gt;']) expect(html).toContain(text);
  expect(html).not.toContain('Every posted charge matched');
});
