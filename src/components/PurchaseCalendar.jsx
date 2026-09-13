import { useMemo, useState } from 'react';
import { budgetMoney } from './BudgetImpact.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const atNoon = iso => new Date(`${iso}T12:00:00Z`);
const iso = date => date.toISOString().slice(0, 10);
const monthKey = date => date.slice(0, 7);
const shortDate = date => atNoon(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthHeading = date => atNoon(`${monthKey(date)}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function movePurchaseMonth(date, delta) {
  const current = atNoon(`${monthKey(date)}-01`);
  current.setUTCMonth(current.getUTCMonth() + delta);
  return iso(current);
}

export function purchaseCalendarDays(date) {
  const first = atNoon(`${monthKey(date)}-01`);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
  const days = [];
  for (let blank = 0; blank < first.getUTCDay(); blank += 1) days.push(null);
  for (let day = 1; day <= last.getUTCDate(); day += 1) days.push(`${monthKey(date)}-${String(day).padStart(2, '0')}`);
  while (days.length % 7) days.push(null);
  return days;
}

function planningBounds(today) {
  const min = atNoon(today), max = atNoon(today);
  min.setUTCDate(min.getUTCDate() - 30);
  max.setUTCDate(max.getUTCDate() + 730);
  return { min: iso(min), max: iso(max) };
}

export default function PurchaseCalendar({ today, purchases, onAdd, onReview }) {
  const [viewDate, setViewDate] = useState(today);
  const days = useMemo(() => purchaseCalendarDays(viewDate), [viewDate]);
  const month = monthKey(viewDate);
  const monthPurchases = useMemo(() => purchases.filter(p => monthKey(p.date) === month), [purchases, month]);
  const byDay = useMemo(() => monthPurchases.reduce((groups, purchase) => {
    (groups[purchase.date] ||= []).push(purchase);
    return groups;
  }, {}), [monthPurchases]);
  const bounds = planningBounds(today);
  const canMoveBack = month > monthKey(bounds.min);
  const canMoveForward = month < monthKey(bounds.max);
  const move = delta => setViewDate(movePurchaseMonth(viewDate, delta));
  const chooseMonth = event => setViewDate(`${event.target.value}-01`);

  return <section className="purchase-calendar card" aria-labelledby="purchase-calendar-title">
    <header className="purchase-calendar-toolbar">
      <div><span className="review-eyebrow">Purchase calendar</span><h2 id="purchase-calendar-title">{monthHeading(viewDate)}</h2>
        <p>{monthPurchases.length} planned {monthPurchases.length === 1 ? 'purchase' : 'purchases'} this month</p></div>
      <div className="purchase-calendar-controls">
        <button className="calendar-arrow" onClick={() => move(-1)} disabled={!canMoveBack} aria-label="Previous month">‹</button>
        <label><span>Month and year</span><input type="month" min={monthKey(bounds.min)} max={monthKey(bounds.max)} value={month} onChange={chooseMonth} /></label>
        <button className="calendar-arrow" onClick={() => move(1)} disabled={!canMoveForward} aria-label="Next month">›</button>
        <button className="btn ghost sm" onClick={() => setViewDate(today)}>Today</button>
      </div>
    </header>

    <div className="purchase-calendar-weekdays" aria-hidden="true">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
    <div className="purchase-calendar-grid" role="grid" aria-label={monthHeading(viewDate)}>
      {days.map((date, index) => {
        if (!date) return <span className="purchase-calendar-blank" aria-hidden="true" key={`blank-${index}`} />;
        const eligible = date >= bounds.min && date <= bounds.max;
        return <div className={`purchase-calendar-cell${date === today ? ' today' : ''}${eligible ? '' : ' unavailable'}`} role="gridcell" key={date}>
          <button className="purchase-calendar-cell-action" disabled={!eligible} onClick={() => onAdd(date)}
            aria-label={`Add purchase on ${shortDate(date)}`}
            title={eligible ? `Add purchase on ${shortDate(date)}` : 'Outside the planning range'} />
          <div className="purchase-calendar-date" aria-hidden="true">
            <span>{Number(date.slice(8))}</span>
            <span className="purchase-calendar-add">+</span>
          </div>
          <div className="purchase-calendar-items">{(byDay[date] || []).slice(0, 2).map(purchase => <button key={purchase.id} onClick={() => onReview(purchase.id)}
            aria-label={`Edit ${purchase.label}`} title={`${purchase.label} · ${budgetMoney(purchase.amount)}`}>
            <span>{purchase.label}</span><b>{budgetMoney(purchase.amount)}</b></button>)}
            {(byDay[date] || []).length > 2 && <span className="purchase-calendar-more">+{byDay[date].length - 2} more</span>}
          </div>
        </div>;
      })}
    </div>

    <p className="purchase-calendar-help">Select any day to add a purchase there. Select a saved purchase to edit or remove it.</p>
  </section>;
}
