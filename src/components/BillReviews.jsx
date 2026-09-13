import { budgetMoney, budgetDate } from './BudgetImpact.jsx';
import { NEXT_STEPS } from '../engine/bill-reviews.js';

export default function BillReviews({ pending, reviews = {}, notes = {}, open }) {
  const saved = Object.entries(reviews).sort((a,b) => b[1].postedDate.localeCompare(a[1].postedDate));
  return <section className="card bill-reviews" aria-label="Bill charge reviews">
    <div className="hd"><h2>Charge reviews</h2><span className={`pill ${pending.length ? 'warn' : 'good'}`}>{pending.length ? `${pending.length} to review` : 'Up to date'}</span></div>
    <p>A different charge is a reason to check, not proof of a new price. Choose an estimate and keep a next step.</p>
    {pending.map(b => <div className="bill-review-entry" key={b.id}>
      <div><h3>{b.label}</h3><p>{budgetMoney(b.lastPosted)} posted {budgetDate(b.lastPostedDate)} · earlier average {budgetMoney(b.usual ?? b.amount)}</p></div>
      <button className="btn sm" onClick={() => open('anomaly',b.id)}>Review {b.label.toLowerCase()} charge</button>
    </div>)}
    {!pending.length && <p className="fine">No unreviewed charge differences. Your saved follow-ups are separate from budget alerts.</p>}
    {!!saved.length && <details className="bill-review-history" open>
      <summary>Saved follow-ups &amp; notes · {saved.length}</summary>
      {saved.map(([key,r]) => <article className="bill-review-entry" key={key}>
        <div><h3>{r.label} · {budgetDate(r.postedDate)}</h3>
          <p>Posted {budgetMoney(r.amount)} · forecast estimate {budgetMoney(r.forecastAmount)}</p>
          <span className="pill neutral">{r.reviewed ? NEXT_STEPS[r.nextStep] : 'Review reopened'}</span>
          {notes[key] && <p className="bill-note">{notes[key]}</p>}
        </div>
        <button className="btn ghost sm" onClick={() => open('anomaly',key)} aria-label={`View / edit review for ${r.label} on ${budgetDate(r.postedDate)}`}>View / edit review</button>
      </article>)}
      <p className="fine">Reviews and notes stay in this browser. Use them when you contact the company or a future charge changes again.</p>
    </details>}
  </section>;
}
