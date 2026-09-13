import { useState } from 'react';
import { Icon, money, prettyIso } from '../components/ui.jsx';
import { amountFor, nextChargeDate, monthlyEquivalent } from '../engine/forecast.js';
import Discovered from '../components/Discovered.jsx';
import { needsBillReview, NEXT_STEPS } from '../engine/bill-reviews.js';

const monthKey = date => date?.slice(0, 7);
const monthName = key => new Date(`${key}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const monthRangeName = key => new Date(`${key}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const paymentDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function sortPostedPayments(payments = []) {
  return [...payments].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))
    || String(b.id || '').localeCompare(String(a.id || '')));
}

export function paymentsForYear(payments = [], year) {
  return sortPostedPayments(payments).filter(payment => payment.date?.startsWith(`${year}-`));
}

export function recurringYear(items, today, selection = today.slice(0, 4)) {
  const current = monthKey(today);
  const [currentYear, currentNumber] = current.split('-').map(Number);
  const selectedYear = /^\d{4}$/.test(selection) ? Number(selection) : currentYear;
  const firstSerial = selection === 'last-12' ? currentYear * 12 + currentNumber - 12 : selectedYear * 12;
  const months = Array.from({ length: 12 }, (_, index) => {
    const serial = firstSerial + index;
    const year = Math.floor(serial / 12);
    const number = String(serial % 12 + 1).padStart(2, '0');
    const key = `${year}-${number}`;
    return { key, label: new Date(`${key}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short' }), total: null, count: 0, current: key === current };
  });
  const monthByKey = new Map(months.map(month => [month.key, month]));
  for (const payment of items) {
    if (!Number.isFinite(Number(payment.amount))) continue;
    const month = monthByKey.get(monthKey(payment.date));
    if (!month) continue;
    month.total = (month.total ?? 0) + Number(payment.amount);
    month.count += 1;
  }
  return months.map(month => ({ ...month, total: month.total == null ? null : Math.round(month.total * 100) / 100 }));
}

function reviewsFor(bill, reviews = {}) {
  return Object.entries(reviews)
    .filter(([, review]) => review?.billId === bill.id)
    .sort(([, a], [, b]) => b.postedDate.localeCompare(a.postedDate) || b.updatedAt.localeCompare(a.updatedAt));
}

export function hasAlertRecord(bill, plan = {}) {
  return needsBillReview(bill, plan) || reviewsFor(bill, plan.billReviews).length > 0;
}

export function filterRecurringBills(bills, plan = {}, filter = 'all') {
  if (filter === 'alerts') return bills.filter(bill => hasAlertRecord(bill, plan));
  if (filter === 'clear') return bills.filter(bill => !hasAlertRecord(bill, plan));
  return bills;
}

function CompanyStatus({ bill, plan, reviews }) {
  if (bill.cancelled) return <span className="pill neutral">Cancelled</span>;
  if (bill.pending) return <span className="pill warn">Cancellation pending</span>;
  if (needsBillReview(bill, plan)) return <span className="pill warn">Charge needs review</span>;
  if (reviews.length) return <span className="pill good">Follow-up saved</span>;
  if (!bill.paymentHistory?.length) return <span className="pill neutral">No payments yet</span>;
  return <span className="pill good">Up to date</span>;
}

function PaymentHistory({ bill, year }) {
  const payments = paymentsForYear(bill.paymentHistory, year);
  const largest = Math.max(...payments.map(payment => payment.amount), 1);
  return <section className="recurring-history" aria-label={`${bill.label} payment history`}>
    <div className="section-heading"><div><span className="review-eyebrow">Bank records</span><h3>Payment history</h3></div>
      {!!payments.length && <span className="fine">{payments.length} posted in {year}</span>}</div>
    {payments.length ? <ol>{payments.map(payment => <li key={payment.id || `${payment.date}-${payment.amount}`}>
      <time dateTime={payment.date}>{paymentDate(payment.date)}</time>
      <span className="payment-track" aria-hidden="true"><i style={{ width: `${Math.max(8, payment.amount / largest * 100)}%` }} /></span>
      <b>{money(payment.amount)}</b>
    </li>)}</ol> : <div className="recurring-empty-history">
      <Icon n="list" s={18} /><p>{bill.budgetOnly
        ? 'This is a planned recurring cost. No payment has posted from the bank.'
        : `No posted payments are available for this company in ${year}.`}</p>
    </div>}
  </section>;
}

function YearPaymentChart({ months, currentMonth, selection, years, onSelection }) {
  const largest = Math.max(...months.map(month => month.total ?? 0), 1);
  const range = months.length ? `${monthRangeName(months[0].key)} – ${monthRangeName(months.at(-1).key)}` : '';
  return <section className="recurring-year-chart" aria-labelledby="recurring-year-title">
    <div className="section-heading"><div><span className="review-eyebrow">Payment history</span><h3 id="recurring-year-title">{selection} payment history</h3>
      <span className="fine">{range} · Posted bank payments only</span></div>
      <label className="recurring-range"><span>Show</span><select aria-label="Payment history range" value={selection} onChange={event => onSelection(event.target.value)}>
        {years.map((year, index) => <option value={year} key={year}>{index === 0 ? `This year · ${year}` : year}</option>)}
      </select></label></div>
    <div className="recurring-chart-scroll">
      <ol>
        {months.map(month => {
          const hasData = month.total != null;
          const state = month.current ? 'current' : month.key > currentMonth ? 'future' : hasData ? 'recorded' : 'unavailable';
          const description = `${monthName(month.key)}: ${hasData ? `${money(month.total)} paid` : 'no payment data available'}`;
          return <li key={month.key} className={state} aria-label={description} title={description}>
            <span className="recurring-chart-value" aria-hidden="true">{hasData ? money(month.total) : '—'}</span>
            <span className="recurring-chart-track" aria-hidden="true"><i style={{ height: hasData ? `${Math.max(6, month.total / largest * 100)}%` : 0 }} /></span>
            <span className="recurring-chart-month" aria-hidden="true">{month.label}</span>
          </li>;
        })}
      </ol>
    </div>
  </section>;
}

function CompanyFollowUp({ bill, plan, notes, open }) {
  const reviews = reviewsFor(bill, plan.billReviews);
  const [latestKey, latest] = reviews[0] || [];
  const pending = needsBillReview(bill, plan);
  return <section className={`company-followup${pending ? ' needs-review' : ''}`}>
    <div className="section-heading"><div><span className="review-eyebrow">Alert record</span><h3>Company follow-up</h3></div></div>
    {pending && <>
      <p><b>{money(bill.lastPosted)} posted {prettyIso(bill.lastPostedDate)}</b>, compared with an earlier average of {money(bill.usual ?? bill.amount)}.</p>
      <p className="fine">The bank record shows the difference, but not why it happened.</p>
      <button className="btn sm" onClick={() => open('anomaly', bill.id)}>Review charge and save follow-up</button>
    </>}
    {!pending && latest && <>
      <div className="followup-status"><span className="pill neutral">{NEXT_STEPS[latest.nextStep]}</span><span className="fine">Saved {prettyIso((latest.updatedAt || latest.postedDate).slice(0, 10))}</span></div>
      <p>For the {money(latest.amount)} payment on {prettyIso(latest.postedDate)}.</p>
      {notes[latestKey] ? <blockquote>{notes[latestKey]}</blockquote> : <p className="fine">No private contact note was saved.</p>}
      <button className="btn ghost sm" onClick={() => open('anomaly', latestKey)}>View / edit review</button>
      {reviews.length > 1 && <details className="previous-followups"><summary>{reviews.length - 1} earlier follow-up{reviews.length === 2 ? '' : 's'}</summary>
        {reviews.slice(1).map(([key, review]) => <button className="previous-followup" key={key} onClick={() => open('anomaly', key)}>
          <span>{prettyIso(review.postedDate)} · {NEXT_STEPS[review.nextStep]}</span><b>{money(review.amount)}</b>
        </button>)}
      </details>}
    </>}
    {!pending && !latest && <p className="fine">No alert follow-up has been saved for this company.</p>}
  </section>;
}

export default function RecurringPage({ h, sc, plan, change, open, discovered = [], onAdopt, onDismiss, billNotes = {} }) {
  const [filter, setFilter] = useState('all');
  const currentYear = h.today.slice(0, 4);
  const [historyRange, setHistoryRange] = useState(currentYear);
  const bills = h.recurring.map(bill => {
    const next = nextChargeDate(bill, h.today);
    return {
      ...bill,
      paymentHistory: sortPostedPayments(bill.paymentHistory),
      next,
      amountNow: amountFor(bill, next, sc),
      perMonth: monthlyEquivalent(bill, amountFor(bill, next, sc)),
      cancelled: !!sc.cancelled?.[bill.id],
      pending: !!sc.pendingCancel?.[bill.id] && !sc.cancelled?.[bill.id],
    };
  }).sort((a, b) => a.label.localeCompare(b.label));
  const posted = bills.flatMap(bill => bill.paymentHistory || []);
  const currentMonth = monthKey(h.today);
  const availableYears = [...new Set([currentYear, ...posted.map(payment => payment.date?.slice(0, 4)).filter(Boolean)])].sort((a, b) => b.localeCompare(a));
  const selectedRange = availableYears.includes(historyRange) ? historyRange : currentYear;
  const year = recurringYear(posted, h.today, selectedRange);
  const summaryMonths = recurringYear(posted, h.today, 'last-12');
  const current = summaryMonths.at(-1);
  const previous = summaryMonths.at(-2);
  const reviews = Object.keys(plan.billReviews || {}).length;
  const pendingReviews = bills.filter(bill => needsBillReview(bill, sc));
  const alertRecords = bills.filter(bill => hasAlertRecord(bill, sc));
  const visibleBills = filterRecurringBills(bills, sc, filter);

  const confirmCancelled = id => change({ cancelled: { [id]: true } }, 'Cancellation confirmed');
  const dropPending = id => change({ pendingCancel: { [id]: undefined } }, 'Cancellation withdrawn');
  const restore = id => change({ cancelled: { [id]: undefined } }, 'Commitment restored');

  return <>
    <div className="topbar recurring-topbar"><div><h1>Recurring</h1>
      <div className="sub">What you paid each month, with company follow-ups kept beside the charge. New costs are previewed before they change your plan.</div></div>
      <button className="btn sm" onClick={() => open('subscription')}>Add recurring cost</button>
    </div>

    <section className="recurring-month-summary" aria-label="Recurring payment overview">
      <div className="recurring-year-overview">
        <article className="recurring-month-focus">
          <span className="review-eyebrow">{monthName(currentMonth)} to date</span>
          <h2>Paid this month</h2>
          <b>{money(current?.total ?? 0)}</b>
          <p>{current?.count || 0} posted payment{current?.count === 1 ? '' : 's'}</p>
          {previous?.total != null && <div className="recurring-previous-month"><span>{previous.label} total</span><strong>{money(previous.total)}</strong></div>}
        </article>
        <YearPaymentChart months={year} currentMonth={currentMonth} selection={selectedRange} years={availableYears} onSelection={setHistoryRange} />
      </div>
      <div className="recurring-review-summary">
        <span className={`pill ${pendingReviews.length ? 'warn' : 'good'}`}>{pendingReviews.length ? `${pendingReviews.length} to review` : 'Reviews up to date'}</span>
        <span className="fine">{reviews ? `${reviews} saved follow-up${reviews === 1 ? '' : 's'}` : 'No company follow-ups saved yet'}</span>
      </div>
      <div className="recurring-filter" role="group" aria-label="Filter recurring records">
        {[
          ['all', 'All records', bills.length],
          ['alerts', 'Has alert record', alertRecords.length],
          ['clear', 'No alert record', bills.length - alertRecords.length],
        ].map(([value, label, count]) => <button type="button" key={value} aria-pressed={filter === value}
          onClick={() => setFilter(value)}><span>{label}</span><b>{count}</b></button>)}
      </div>
      <p className="recurring-filter-help">Alert records include charges awaiting review and company follow-ups you already saved.</p>
    </section>

    <div className="recurring-ledger">
      {visibleBills.map(bill => {
        const billReviews = reviewsFor(bill, plan.billReviews);
        const lastPayment = bill.paymentHistory?.[0];
        return <details className="recurring-company" key={bill.id}>
          <summary>
            <span className="recurring-company-icon"><Icon n="repeat" s={18} /></span>
            <span className="recurring-company-name"><b>{bill.label}</b><small>{bill.payee || bill.category || 'Recurring cost'}</small></span>
            <span className="recurring-company-latest"><small>{lastPayment ? `Paid ${paymentDate(lastPayment.date)}` : 'Expected amount'}</small><b>{money(lastPayment?.amount ?? bill.amountNow)}</b></span>
            <CompanyStatus bill={bill} plan={sc} reviews={billReviews} />
          </summary>
          <div className="recurring-company-body">
            <PaymentHistory bill={bill} year={selectedRange} />
            <CompanyFollowUp bill={bill} plan={sc} notes={billNotes} open={open} />
          </div>
          <div className="recurring-company-footer">
            <span>Next expected {bill.cancelled ? '—' : prettyIso(bill.next)} · {bill.freq || 'Monthly'} · {money(bill.perMonth)}/month</span>
            <div className="row wrap">
              {bill.budgetOnly && <button className="btn ghost sm" onClick={() => open('subscription', bill.id)}>Edit estimate</button>}
              {bill.pending && <><button className="btn sm" onClick={() => confirmCancelled(bill.id)}>It is cancelled</button><button className="btn ghost sm" onClick={() => dropPending(bill.id)}>Keep it</button></>}
              {bill.cancelled && <button className="btn ghost sm" onClick={() => restore(bill.id)}>Restore</button>}
            </div>
          </div>
        </details>;
      })}
      {!visibleBills.length && <div className="recurring-filter-empty"><Icon n="check" s={20} /><div><b>No records in this view</b><p>Choose another filter to see your recurring costs.</p></div></div>}
    </div>

    {!!discovered.length && <div className="recurring-discovered"><Discovered found={discovered} onAdopt={onAdopt} onDismiss={onDismiss} /></div>}
  </>;
}
