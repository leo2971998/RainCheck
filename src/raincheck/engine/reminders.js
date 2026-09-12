// src/engine/reminders.js
//
// A reminder is a different thing from an alert.
//
//   insight     "Your internet bill went up."
//   consequence "That puts your contribution below your cushion."
//   reminder    "Rent is due in three days."
//
// The first two are about a change and belong in the alert list. A reminder is about a date, and
// it should stop the moment the payment is confirmed or the commitment is cancelled.
//
// These are IN-APP only. Nothing here sends anything while the app is closed, and the UI says so
// rather than implying a notification that never arrives.

import { nextChargeDate, amountFor } from './forecast.js';

const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);

/**
 * Commitments charging within `leadDays`, that the user has not already dealt with.
 * @param sc.paid  billId → the 'YYYY-MM' of a charge already confirmed paid
 */
export function buildReminders(h, sc = {}, leadDays = 3) {
  const out = [];
  for (const r of h.recurring) {
    if (sc.cancelled?.[r.id]) continue;                       // nothing is coming
    const due = nextChargeDate(r, h.today);
    if (!due) continue;

    const inDays = daysBetween(h.today, due);
    if (inDays < 0 || inDays > leadDays) continue;

    // Once the user confirms this cycle is paid, the reminder stops until the next one.
    if (sc.paid?.[r.id] === due.slice(0, 7)) continue;

    out.push({
      id: `due:${r.id}:${due}`,
      billId: r.id,
      label: r.label,
      due,
      cycle: due.slice(0, 7),
      amount: amountFor(r, due, sc),
      inDays,
      when: inDays === 0 ? 'today' : inDays === 1 ? 'tomorrow' : `in ${inDays} days`,
    });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

/** Lead times the user can choose between. */
export const LEAD_TIMES = [
  { days: 1, label: 'The day before' },
  { days: 3, label: 'Three days ahead' },
  { days: 7, label: 'A week ahead' },
];
