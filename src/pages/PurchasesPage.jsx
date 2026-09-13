import PurchaseCalendar from '../components/PurchaseCalendar.jsx';
import { budgetMoney } from '../components/BudgetImpact.jsx';

const shortDate = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function PurchasesPage({ h, available, open }) {
  const records = h.plannedPurchases || [];
  const planned = records.filter(p => p.status === 'planned').sort((a,b) => a.date.localeCompare(b.date));
  const plannedTotal = planned.reduce((sum, purchase) => sum + Number(purchase.amount || 0), 0);
  const next = planned.find(purchase => purchase.date >= h.today) || planned[0];
  return <>
    <div className="topbar"><div><h1>Planned purchases</h1><div className="sub">See what a one-time purchase would change, before you spend.</div></div>
      <button className="btn" disabled={!available} onClick={() => open('purchase', null, h.today)}>Plan a purchase</button></div>
    {!available ? <p className="alert">Connect to the RainCheck demo to save and edit purchases.</p> : <>
      <section className="purchase-overview card" aria-labelledby="purchase-overview-title">
        <header><div><span className="review-eyebrow">Purchase overview</span><h2 id="purchase-overview-title">Your plans at a glance</h2></div>
          <p>Select a date below to add something, or select a saved purchase to edit it.</p></header>
        <div className="purchase-overview-stats">
          <article><span>On your calendar</span><strong>{planned.length} planned</strong><small>Future purchase estimates</small></article>
          <article><span>Planned total</span><strong>{budgetMoney(plannedTotal)}</strong><small>Across all planned purchases</small></article>
          <article className="purchase-overview-next"><span>Next purchase</span>{next ? <><strong>{next.label}</strong><small>{shortDate(next.date)} · {budgetMoney(next.amount)}</small></> : <><strong>Nothing planned</strong><small>Choose a date in the calendar</small></>}</article>
        </div>
      </section>
      <PurchaseCalendar today={h.today} purchases={planned} onAdd={date => open('purchase', null, date)} onReview={id => open('purchase', id)} />
    </>}
  </>;
}
