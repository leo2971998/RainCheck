// src/engine/forecast.js
// The forecast engine. Pure functions, no React, no wall-clock dates.
import { purchaseSchedule } from './purchases.js';
import { latestBillEstimate } from './bill-reviews.js';

export const iso = d => d.toISOString().slice(0, 10);
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const round2 = n => Math.round(n * 100) / 100;

/** A date a person would say out loud. The engine reports dates it checked, so it must say them plainly. */
const longIso = key => new Date(key + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/** Four statuses, decided only by the projected balance against the user's cushion. Never a score. */
export const stateOf = (b, cushion) => b < 0 ? 'over' : b < cushion ? 'below' : b < cushion + 100 ? 'tight' : 'ok';

/** Does a commitment fall on this date? Monthly by default; `everyMonths` handles longer cycles. */
export function fallsOn(r, date, startIso) {
  if (r.startsOn && iso(date) < r.startsOn) return false;
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  if (date.getDate() !== Math.min(r.day, lastDay)) return false;
  const every = r.everyMonths || 1;
  if (every === 1) return true;
  // Count whole months from the commitment's anchor so annual bills land once a year, not monthly.
  const anchor = new Date((r.anchor || startIso) + 'T12:00:00');
  const months = (date.getFullYear() - anchor.getFullYear()) * 12 + (date.getMonth() - anchor.getMonth());
  return months >= 0 && months % every === 0;
}

/**
 * The amount a commitment will actually post, given what the user is considering.
 *
 * A change belongs to one bill. There used to be a single scenario-wide `increase`, which meant
 * an internet rise and a separate subscription renewal could not both exist, and a what-if typed
 * against one bill silently moved the other.
 */
export function amountFor(r, key, sc = {}) {
  if (r.change && key >= r.change.effective) {
    // A figure the user typed overrides the notice for THIS bill only.
    return sc.whatIf?.[r.id] ?? r.change.to;
  }
  const reviewedEstimate = latestBillEstimate(r, sc, key);
  if (reviewedEstimate != null) return reviewedEstimate;
  // Compatibility with earlier saved decisions, migrated to charge-specific reviews on load.
  if (r.unexplained && sc.treatAsNewPrice?.[r.id]) return r.lastPosted;
  return r.amount;
}

/** What a bill is currently assumed to become, and whether the user typed that figure. */
export function changeOf(r, sc = {}) {
  if (!r.change) return null;
  const typed = sc.whatIf?.[r.id];
  const to = typed ?? r.change.to;
  return { ...r.change, to, increase: round2(to - r.amount), whatIf: typed != null, noticeSays: r.change.to };
}

/**
 * Walk every day in the window, applying money in and money out, and record the end-of-day balance.
 * Everything else in the app reads from this result.
 *
 * IMPORTANT: only `sc.cancelled` removes a commitment — cancellations the user has CONFIRMED
 * actually happened. A cancellation the user merely intends lives in `sc.pendingCancel` and is
 * deliberately ignored here, because the app must never improve someone's forecast by assuming
 * a provider did what they were asked. Use `hypothetical()` to price that intent.
 *
 * @param h  household — facts from the bank. Never mutated.
 * @param sc scenario  — what the user is considering. Never mutated.
 */
export function simulate(h, sc = {}, { days: dayCount } = {}) {
  const income = sc.income || h.income;
  const start = new Date(h.today + 'T12:00:00');
  const windowDays = dayCount ?? h.windowDays;
  // A goal has SEVERAL contribution dates. Checking only the first one and multiplying the result
  // across later months is an extrapolation, not a plan that has been checked.
  const firstPayday = income.map(p => p.date).filter(d => d >= h.today).sort()[0] ?? null;
  const contributionOn = new Set(sc.contributionDates ?? (firstPayday ? [firstPayday] : []));
  const monthlySpend = h.allowances.reduce((a, x) => a + x.monthly - (sc.cuts?.[x.id] || 0), 0);
  const dailySpend = monthlySpend / 30;
  const purchases = purchaseSchedule(h, sc);

  const days = [];
  let balance = h.checking;

  for (let i = 0; i < windowDays; i++) {
    const date = addDays(start, i), key = iso(date), events = [];

    for (const p of income) {
      if (p.date !== key) continue;
      balance += p.amount;
      events.push({ label: p.label, amt: p.amount, pay: true, estimated: p.status !== 'edited' });
    }

    for (const r of h.recurring) {
      if (!fallsOn(r, date, h.today) || sc.cancelled?.[r.id]) continue;
      const amt = amountFor(r, key, sc);
      balance -= amt;
      events.push({ label: r.label, amt: -amt, bill: true, big: amt >= 100, id: r.id });
    }

    if (contributionOn.has(key) && sc.contribution > 0) {
      balance -= sc.contribution;
      events.push({ label: 'Savings contribution', amt: -sc.contribution, transfer: true });
    }

    for (const p of purchases.dates[key] || []) {
      balance -= p.amount;
      events.push({ label: p.label, amt: -p.amount, purchase: true, id: p.id, estimated: true });
    }
    const everyday = Math.max(0, dailySpend - (purchases.reductions[key.slice(0, 7)] || 0));
    balance -= everyday;
    events.push({ label: 'Everyday spending', amt: -everyday, everyday: true });

    days.push({ date, key, balance: round2(balance), events, state: stateOf(balance, h.cushion) });
  }

  const low = days.reduce((a, d) => (d.balance < a.balance ? d : a));
  const worst = ['over', 'below', 'tight', 'ok'].find(s => days.some(d => d.state === s));

  const lastMonth = days[days.length - 1].key.slice(0, 7);
  const month = days.filter(d => d.key.slice(0, 7) === lastMonth);
  const cash = {
    month: lastMonth,
    income: round2(month.reduce((a, d) => a + d.events.filter(e => e.pay).reduce((s, e) => s + e.amt, 0), 0)),
    bills: round2(month.reduce((a, d) => a + d.events.filter(e => e.bill).reduce((s, e) => s - e.amt, 0), 0)),
    everyday: round2(month.reduce((a, d) => a + d.events.filter(e => e.everyday).reduce((s, e) => s - e.amt, 0), 0)),
    purchases: round2(month.reduce((a, d) => a + d.events.filter(e => e.purchase).reduce((s, e) => s - e.amt, 0), 0)),
    savings: sc.contribution,
  };

  return { days, low, worst, dailySpend: round2(dailySpend), monthlySpend, cash, contributionDate: firstPayday, contributionDates: [...contributionOn] };
}

/**
 * Prices an intent without letting it touch the real plan — a cancellation the provider has not
 * confirmed, or an option the user is only previewing.
 */
export function hypothetical(sc, changes = {}) {
  return {
    ...sc, ...changes,
    cuts: { ...sc.cuts, ...(changes.cuts || {}) },
    cancelled: { ...sc.cancelled, ...(changes.cancelled || {}), ...(changes.pendingCancel || {}) },
    treatAsNewPrice: { ...sc.treatAsNewPrice, ...(changes.treatAsNewPrice || {}) },
  };
}

/**
 * The largest monthly contribution that keeps EVERY projected day at or above the cushion.
 * A search, not a formula: bills land on different days, so the tight day moves when anything
 * changes.
 *
 * Note the horizon. This is proven across `h.windowDays` only. Multiplying it across several
 * future months is an extrapolation — see `goalAt`, which labels it as one.
 */
export function capacity(h, sc = {}, max = 600, step = 5) {
  for (let c = max; c >= 0; c -= step)
    if (simulate(h, { ...sc, contribution: c }).low.balance >= h.cushion) return c;
  return 0;
}

/** Contribution dates: the same month-day as the first expected paycheck, once a month. */
export function contributionDates(h, left) {
  const first = (h.income[0]?.date) || h.today;
  const d = new Date(first + 'T12:00:00');
  return Array.from({ length: Math.max(0, left) }, (_, i) =>
    new Date(d.getFullYear(), d.getMonth() + i, d.getDate(), 12).toISOString().slice(0, 10));
}

/**
 * What the goal looks like at a given monthly contribution.
 * `schedule` and `left` always agree, so the list of dates can never disagree with the count.
 */
export function goalAt(h, contribution, left = h.goal.left) {
  const projected = round2(h.goal.saved + left * contribution);
  const gap = round2(Math.max(0, h.goal.target - projected));
  const monthsNeeded = contribution > 0 ? Math.ceil((h.goal.target - h.goal.saved) / contribution) : Infinity;
  const schedule = contributionDates(h, left);
  return {
    projected, gap, monthsNeeded, contributions: round2(left * contribution), left, contribution, schedule,
    onTarget: gap === 0,
    // Said plainly wherever this number is shown. It is a projection, not a proven schedule.
    assumption: `Assumes ${money(contribution)} a month continues for ${left} month${left === 1 ? '' : 's'}. Only the next ${h.windowDays} days have been checked against your bills.`,
  };
}

/**
 * The smallest monthly trim to one allowance that restores a target contribution.
 * Never simply "cut what the bill went up by": a monthly cut only partly lands before the tight
 * day, so the search finds the real number. Returns null when no trim up to `max` is enough.
 */
export function cutNeeded(h, sc, allowanceId, want, max = 400, step = 5) {
  for (let cut = 0; cut <= max; cut += step)
    if (capacity(h, { ...sc, cuts: { ...sc.cuts, [allowanceId]: cut } }) >= want) return cut;
  return null;
}

/**
 * The next date a commitment actually charges, respecting its real cycle.
 * An annual renewal must not be reported as due next month, and must not be counted as though
 * its full amount were a monthly cost.
 */
export function nextChargeDate(r, todayIso) {
  const first = r.startsOn && r.startsOn > todayIso ? r.startsOn : todayIso;
  const today = new Date(first + 'T12:00:00');
  for (let i = 0; i < 240; i++) {
    const month = new Date(today.getFullYear(), today.getMonth() + i, 1, 12);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const d = new Date(month.getFullYear(), month.getMonth(), Math.min(r.day, lastDay), 12);
    if (d >= today && fallsOn(r, d, todayIso)) return iso(d);
  }
  return null;
}

/** What a commitment costs per month once its cycle is taken into account. */
export const monthlyEquivalent = (r, amount = r.amount) => amount / (r.everyMonths || 1);

const money = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');


/* ------------------------------------------------------------------ goals by date */

const isoDaysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const addMonths = (iso, n) => { const d = new Date(iso + 'T12:00:00'); return new Date(d.getFullYear(), d.getMonth() + n, d.getDate(), 12).toISOString().slice(0, 10); };

/** Contribution dates from the first expected payday up to and including a target date. */
export function scheduleUntil(h, targetDate) {
  const first = h.income.map(p => p.date).filter(d => d >= h.today).sort()[0] || h.today;
  const out = [];
  for (let i = 0; i < 120; i++) {
    const d = addMonths(first, i);
    if (d > targetDate) break;
    out.push(d);
  }
  return out;
}

/**
 * Paychecks projected out to a date, by repeating the cadence already observed.
 * Clearly an assumption, and labelled as one wherever it is shown.
 */
export function projectIncome(h, throughDate) {
  const known = (h.income || []).filter(p => p.date >= h.today).sort((a, b) => a.date.localeCompare(b.date));
  if (!known.length) return known;
  const cadence = known.length >= 2 ? isoDaysBetween(known[0].date, known[1].date) : 14;
  const out = [...known];
  let date = known[known.length - 1].date;
  const last = known[known.length - 1];
  while (date < throughDate && out.length < 200) {
    date = new Date(new Date(date + 'T12:00:00').getTime() + cadence * 864e5).toISOString().slice(0, 10);
    out.push({ ...last, id: 'p' + out.length, date, status: 'projected' });
  }
  return out;
}

/**
 * Run the forecast across the WHOLE goal, not just the next few weeks.
 * This is what turns "this contribution fits next month" into "every contribution in this plan
 * fits", which multiplying one month's affordable figure never established.
 */
export function validatePlan(h, sc, { contribution, schedule, throughDate }) {
  if (!schedule.length) return { ok: false, low: null, checkedThrough: null, horizonDays: 0 };
  const last = schedule[schedule.length - 1];
  const end = throughDate && throughDate > last ? throughDate : last;
  const horizonDays = Math.max(h.windowDays, isoDaysBetween(h.today, end) + 3);
  const income = projectIncome(h, end);
  const sim = simulate(h, { ...sc, income, contribution, contributionDates: schedule }, { days: horizonDays });
  return { ...sim, ok: sim.low.balance >= h.cushion, checkedThrough: end, horizonDays };
}

/** The largest contribution that clears the cushion on EVERY day of the whole schedule. */
export function affordableOver(h, sc, schedule, max = 600, step = 5, throughDate) {
  for (let c = max; c >= 0; c -= step)
    if (validatePlan(h, sc, { contribution: c, schedule, throughDate }).ok) return c;
  return 0;
}

/**
 * A goal expressed the way a person expresses one: an amount, by a date.
 * Contribution counts are a consequence of that, not the way the user states it.
 */
export function goalPlan(h, sc, { target, targetDate, saved, contribution = null }) {
  const schedule = scheduleUntil(h, targetDate);
  const left = schedule.length;
  const remaining = Math.max(0, target - saved);
  const required = remaining === 0 ? 0 : left ? Math.ceil(Math.round(remaining * 100) / left) / 100 : Infinity;
  const supported = affordableOver(h, sc, schedule, 600, 5, targetDate);
  const using = contribution ?? (remaining === 0 ? 0 : supported);
  const projected = round2(saved + left * using);
  const gap = round2(Math.max(0, target - projected));
  const check = validatePlan(h, sc, { contribution: using, schedule, throughDate: targetDate });

  return {
    target, targetDate, saved, schedule, left,
    required, supported, contribution: using,
    projected, gap, onTarget: gap === 0,
    feasible: remaining === 0 || (left > 0 && required <= supported),
    fits: check.ok,                       // does THIS contribution clear the cushion throughout?
    low: check.low, checkedThrough: check.checkedThrough, horizonDays: check.horizonDays,
    assumption: check.checkedThrough
      ? `Checked against every bill and paycheck through ${longIso(check.checkedThrough)}. Paychecks beyond the next three repeat your current cadence.`
      : 'No contribution is scheduled before this deadline. Choose a later date to explore future savings.',
  };
}

/** Keeping the current spending plan: when would the goal actually be reached? */
export function dateToReach(h, sc, { target, saved, contribution }) {
  if (!(contribution > 0) || saved >= target) return { date: null, months: 0 };
  const first = h.income.map(p => p.date).filter(d => d >= h.today).sort()[0] || h.today;
  const months = Math.ceil((target - saved) / contribution);
  return { date: addMonths(first, months - 1), months };
}
