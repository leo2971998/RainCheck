import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RecurringPage, { filterRecurringBills, paymentsForYear, recurringYear } from '../src/pages/RecurringPage.jsx';
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

it('leads Alerts with one resolvable item and keeps the rest in a compact queue', () => {
  const alerts = [
    { id: 'unexplained:electric', tone: 'warn', title: 'Reliant Energy payment is higher than usual.',
      body: '$128 posted against a usual $108.', amount: 128, metricLabel: 'posted charge',
      actions: [{ label: 'Review charge', target: 'anomaly', billId: 'electric', primary: true }] },
    { id: 'cushion', tone: 'bad', title: 'Checking falls below your cushion.',
      body: 'Your plan needs an adjustment before the next paycheck.', amount: 192.19, metricLabel: 'projected balance',
      actions: [{ label: 'Compare options', target: 'compare', primary: true }] },
  ];
  const html = renderToStaticMarkup(<AlertsPage h={h} sc={emptyPlan()} alerts={alerts} reminders={[]} open={() => {}} />);

  expect(html).toContain('2 things need you');
  expect(html).toContain('Plan date Sep 28, 2026');
  expect(html).toContain('alert-card bad lead');
  expect(html).toContain('$192.19');
  expect(html).not.toContain('Nothing changes until you choose');
  expect(html.match(/class="alert-card /g)).toHaveLength(2);
  expect(html).toContain('Reliant Energy payment is higher than usual.');
});

it('shows resolved bill decisions as collapsed, reopenable history', () => {
  const key = billReviewKey(bill);
  const review = createBillReview(bill, { forecastAmount: 110, nextStep: 'contact' }, '2026-09-13T18:00:00.000Z');
  const html = renderToStaticMarkup(<AlertsPage h={h} sc={{ ...emptyPlan(), billReviews: { [key]: review } }} alerts={[]} reminders={[]} open={() => {}} />);

  expect(html).toContain('Resolved');
  expect(html).toContain('Electric');
  expect(html).toContain('Contact the company');
  expect(html).toContain('Sep 13');
  expect(html).toContain(`aria-label="View or reopen Electric review"`);
  expect(html).not.toContain('Open a decision to update its notes');
  expect(html).not.toContain('class="alerts-resolved" open=""');
});

it('uses a calm empty state and keeps upcoming bills on the Alerts page', () => {
  const reminders = [{ id: 'internet', billId: 'internet', label: 'Internet', due: '2026-10-01', when: 'in 3 days', amount: 65 }];
  const html = renderToStaticMarkup(<AlertsPage h={h} sc={emptyPlan()} alerts={[]} reminders={reminders} leadDays={3} setLeadDays={() => {}} onPaid={() => {}} open={() => {}} />);

  expect(html).toContain('Nothing needs you');
  expect(html).toContain('Next check-in when your paycheck lands Oct 2');
  expect(html).toContain('Bills due soon');
  expect(html).not.toContain('Shown while RainCheck is open');
  expect(html).not.toContain('Marking one paid stops it until the next charge');
});
it('keeps ordinary upcoming bills out of the actionable alert count', () => {
  const html = renderToStaticMarkup(<Dashboard h={h} source="sample" plan={plan} sc={sc} sim={simulate(h,sc)} cap={0}
    goal={{...goalAt(h,0),fits:true}} alerts={[]} reminders={[{label:'Internet',when:'in 3 days',amount:65}]} open={() => {}} />);
  expect(html.includes('1 needs your attention')).toBe(false);
  expect(html).toContain('All clear');
  expect(html).toContain('No action needed');
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
  const withHistory={...h,recurring:h.recurring.map(r=>r.id===bill.id?{...r,paymentHistory:[
    {id:'sep',date:'2026-09-06',amount:128},{id:'aug',date:'2026-08-06',amount:110},
  ]}:r)};
  const html=renderToStaticMarkup(<RecurringPage h={withHistory} sc={saved} plan={saved} billNotes={{[key]:'Ask about usage <script>alert(1)</script>'}} cap={0} open={() => {}} />);
  for (const text of ['Payment history', 'Company follow-up', 'Ask the company', 'View / edit review', 'Ask about usage &lt;script&gt;']) expect(html).toContain(text);
  expect(html).toContain('Paid this month');
  expect(html).not.toContain('Reviews and notes stay in this browser');
  expect(html).not.toContain('Savings goal');
  expect(html).not.toContain('Every posted charge matched');
});

it('separates companies with alert records from ordinary recurring records', () => {
  const reviewedBill = h.recurring.find(r => r.id !== bill.id);
  const reviewKey = billReviewKey(reviewedBill);
  const saved = {
    ...emptyPlan(),
    billReviews: {
      [reviewKey]: createBillReview(
        { ...reviewedBill, unexplained: true, lastPosted: reviewedBill.amount, lastPostedDate: '2026-09-01' },
        { forecastAmount: reviewedBill.amount, nextStep: 'contact' },
      ),
    },
  };

  const withAlerts = filterRecurringBills(h.recurring, saved, 'alerts');
  const withoutAlerts = filterRecurringBills(h.recurring, saved, 'clear');

  expect(withAlerts.map(record => record.id)).toContain(bill.id);
  expect(withAlerts.map(record => record.id)).toContain(reviewedBill.id);
  expect(withoutAlerts.map(record => record.id)).not.toContain(bill.id);
  expect(withoutAlerts.map(record => record.id)).not.toContain(reviewedBill.id);
  expect([...withAlerts, ...withoutAlerts]).toHaveLength(h.recurring.length);
});

it('keeps completed follow-ups collapsed until the company record is selected', () => {
  const key = billReviewKey(bill);
  const saved = { ...emptyPlan(), billReviews: { [key]: createBillReview(bill, { forecastAmount: bill.amount, nextStep: 'contact' }) } };
  const reviewedHousehold = { ...h, recurring: h.recurring.map(record => ({ ...record, unexplained: false })) };

  const html = renderToStaticMarkup(<RecurringPage h={reviewedHousehold} sc={saved} plan={saved} cap={0} open={() => {}} />);

  expect(html).toContain('Follow-up saved');
  expect(html).not.toContain('class="recurring-company" open=""');
});

it('keeps companies with an unresolved charge collapsed on entry', () => {
  const html = renderToStaticMarkup(<RecurringPage h={h} sc={emptyPlan()} plan={emptyPlan()} cap={0} open={() => {}} />);
  expect(html).toContain('Charge needs review');
  expect(html).not.toContain('class="recurring-company" open=""');
});

it('shows this month as one total and builds a rolling 12-month posted-payment series', () => {
  // Explicit records keep this behavior test independent of in-progress demo seeding.
  const payments = [
    { date: '2025-10-01', amount: 65 }, { date: '2025-10-05', amount: 1200 },
    { date: '2026-08-01', amount: 65 }, { date: '2026-09-01', amount: 90 },
  ];
  const year = recurringYear(payments, h.today, 'last-12');

  expect(year).toHaveLength(12);
  expect(year[0]).toMatchObject({ key: '2025-10', label: 'Oct', total: 1265, count: 2 });
  expect(year[10]).toMatchObject({ key: '2026-08', label: 'Aug', total: 65, count: 1 });
  expect(year[11]).toMatchObject({ key: '2026-09', label: 'Sep', total: 90, count: 1, current: true });
  expect(year.some(month => month.key > '2026-09')).toBe(false);

  const household = { ...h, recurring: [{ ...h.recurring[0], paymentHistory: payments }] };
  const html = renderToStaticMarkup(<RecurringPage h={household} sc={sc} plan={plan} cap={0} open={() => {}} />);
  expect(html).toContain('Paid this month');
  expect(html).toContain('2026 payment history');
  expect(html).toContain('This year · 2026');
  expect(html).toContain('>2025</option>');
  expect(html).not.toContain('Last 12 months');
  expect(html).toContain('September 2026 to date');
  expect(html).not.toContain('class="recurring-months"');
});

it('defaults payment history to the current calendar year', () => {
  const payments = h.recurring.flatMap(record => record.paymentHistory || []);
  const year = recurringYear(payments, h.today);

  expect(year).toHaveLength(12);
  expect(year[0].key).toBe('2026-01');
  expect(year.at(-1).key).toBe('2026-12');
  expect(year.some(month => month.key.startsWith('2025-'))).toBe(false);
});

it('sorts each company payment history by full date across calendar years', () => {
  const record = { ...h.recurring[0], unexplained: false, paymentHistory: [
    { id: 'old', date: '2025-12-15', amount: 40 },
    { id: 'new', date: '2026-02-15', amount: 42 },
    { id: 'middle', date: '2026-01-15', amount: 41 },
  ] };
  const household = { ...h, recurring: [record] };
  const html = renderToStaticMarkup(<RecurringPage h={household} sc={emptyPlan()} plan={emptyPlan()} cap={0} open={() => {}} />);

  expect(html).toContain('Paid Feb 15, 2026');
  expect(html.indexOf('Feb 15, 2026')).toBeLessThan(html.indexOf('Jan 15, 2026'));
  expect(html).not.toContain('Dec 15, 2025');
});

it('filters company payment history to the selected year without an older-payments split', () => {
  const record = { ...h.recurring[0], unexplained: false, paymentHistory: [
    ...Array.from({ length: 6 }, (_, index) => ({ id: `new-${index}`, date: `2026-0${index + 1}-15`, amount: 40 + index })),
    { id: 'old-2', date: '2025-12-15', amount: 39 },
    { id: 'old-1', date: '2025-11-15', amount: 38 },
  ] };
  const household = { ...h, recurring: [record] };
  const html = renderToStaticMarkup(<RecurringPage h={household} sc={emptyPlan()} plan={emptyPlan()} cap={0} open={() => {}} />);

  expect(html).toContain('6 posted in 2026');
  expect(html).not.toContain('Show 2 older payments');
  expect(html).not.toContain('Dec 15, 2025');
  expect(paymentsForYear(record.paymentHistory, '2025').map(payment => payment.id)).toEqual(['old-2', 'old-1']);
});

it('keeps yearly chart totals equal to the selected company payment records', () => {
  const payments = [
    { id: 'a', date: '2025-12-15', amount: 39 },
    { id: 'b', date: '2026-01-15', amount: 42 },
    { id: 'c', date: '2026-02-15', amount: 41 },
  ];
  for (const selectedYear of ['2026', '2025']) {
    const expected = paymentsForYear(payments, selectedYear).reduce((total, payment) => total + payment.amount, 0);
    const displayed = recurringYear(payments, '2026-09-13', selectedYear).reduce((total, month) => total + (month.total || 0), 0);
    expect(displayed).toBe(expected);
  }
});

it('shows a clear empty history for a company with no payments in the selected year', () => {
  const household = { ...h, today: '2026-09-13', recurring: [{ ...h.recurring[0], paymentHistory: [
    { id: 'old', date: '2025-12-15', amount: 39 },
  ] }] };
  const html = renderToStaticMarkup(<RecurringPage h={household} sc={emptyPlan()} plan={emptyPlan()} open={() => {}} />);
  expect(html).toContain('No posted payments are available for this company in 2026.');
  expect(html).toContain('>2025</option>');
  expect(paymentsForYear([], '2025')).toEqual([]);
});
