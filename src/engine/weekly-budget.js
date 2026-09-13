import { simulate, round2 } from './forecast.js';
import { purchaseSchedule, spendingDayDivisor } from './purchases.js';
import { transactionRecords } from './records.js';

const date = iso => new Date(iso + 'T12:00:00Z');
const shift = (iso, n) => new Date(date(iso).getTime() + n * 864e5).toISOString().slice(0, 10);
export function weekDates(asOf) {
  const start = shift(asOf, -((date(asOf).getUTCDay() + 6) % 7));
  return { start, end: shift(start, 6) };
}

// Aggregate the full loaded records, never the 30-row activity preview.
export function activitySummary(snapshot, asOf) {
  const records = transactionRecords(snapshot, asOf);
  const { start, end } = weekDates(asOf);
  const month = records.filter(t => t.date.startsWith(asOf.slice(0, 7)));
  const spending = rows => round2(rows.filter(t => t.amount < 0 && t.kind !== 'transfer').reduce((sum, t) => sum - t.amount, 0));
  return { asOf,
    week: { start, end, spent: spending(records.filter(t => t.date >= start && t.date <= asOf && t.kind !== 'bill')) },
    month: { key: asOf.slice(0, 7), income: round2(month.filter(t => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0)), spent: spending(month) } };
}

/** A conservative weekly envelope. Reserve upcoming bills, purchases and savings first.
 * Initial checking is a ceiling: a later paycheck is never spendable before it arrives.
 * This is a planning estimate, not a bank authorization or a transfer from savings. */
export function weeklyBudget(h, sc = {}) {
  const { start, end } = weekDates(h.today);
  const count = Math.round((date(end) - date(h.today)) / 864e5) + 1;
  const sim = simulate(h, sc, { days: count });
  const monthly = h.allowances.reduce((sum, a) => sum + Math.max(0, a.monthly - (sc.cuts?.[a.id] || 0)), 0);
  const amountForDays = keys => round2(keys.reduce((sum, key) => sum + monthly / spendingDayDivisor(h, key), 0));
  const budget = amountForDays(Array.from({ length: 7 }, (_, i) => shift(start, i)));
  const activity = h.activity?.asOf === h.today ? h.activity : null;
  const spent = activity?.week.spent ?? null;
  const allocations = purchaseSchedule(h, sc).allocations;
  const events = sim.days.flatMap(d => d.events.map(e => ({ ...e, date: d.key })));
  const purchases = events.filter(e => e.purchase);
  const covered = round2(purchases.reduce((sum, p) => sum + (allocations[p.id]?.covered || 0), 0));
  const remainingBudget = round2(Math.max(0, (spent == null ? amountForDays(sim.days.map(d => d.key)) : budget - spent) - covered));
  let reserved = h.checking, essentials = h.checking;
  let lowReserved = h.checking, lowEssentials = h.checking;
  for (const d of sim.days) {
    for (const event of d.events) if (!event.everyday) {
      reserved += event.amt;
      if (!event.transfer) essentials += event.amt;
    }
    lowReserved = Math.min(lowReserved, reserved);
    lowEssentials = Math.min(lowEssentials, essentials);
  }
  const room = round2(lowReserved - h.cushion);
  const available = round2(Math.max(0, Math.min(remainingBudget, room)));
  const shortfall = round2(Math.max(0, remainingBudget - room));
  const state = lowEssentials - remainingBudget < -0.005 ? 'over' : shortfall > 0 ? 'below'
    : room - remainingBudget < 0.01 ? 'tight' : 'ok';
  const total = flag => round2(-events.filter(e => e[flag]).reduce((sum, e) => sum + e.amt, 0)) || 0;
  return { start, end, asOf: h.today, budget, spent, remainingBudget, available, shortfall, state, room,
    overspent: spent == null ? 0 : round2(Math.max(0, spent - budget)),
    bills: events.filter(e => e.bill), billsTotal: total('bill'),
    purchases, purchasesTotal: total('purchase'), covered, savings: total('transfer'),
    expectedIncome: -total('pay') || 0, nextPay: events.find(e => e.pay), month: activity?.month ?? null };
}
