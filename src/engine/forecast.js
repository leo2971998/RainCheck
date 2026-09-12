// src/engine/forecast.js
// The forecast engine. Pure functions, no React, no wall-clock dates.

export const iso = d => d.toISOString().slice(0, 10);
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const round2 = n => Math.round(n * 100) / 100;

/** Four statuses, decided only by the projected balance against the user's cushion. Never a score. */
export const stateOf = (b, cushion) => b < 0 ? 'over' : b < cushion ? 'below' : b < cushion + 100 ? 'tight' : 'ok';

/** Does a commitment fall on this date? Monthly by default; `everyMonths` handles longer cycles. */
export function fallsOn(r, date, startIso) {
  if (date.getDate() !== r.day) return false;
  const every = r.everyMonths || 1;
  if (every === 1) return true;
  // Count whole months from the commitment's anchor so annual bills land once a year, not monthly.
  const anchor = new Date((r.anchor || startIso) + 'T12:00:00');
  const months = (date.getFullYear() - anchor.getFullYear()) * 12 + (date.getMonth() - anchor.getMonth());
  return months >= 0 && months % every === 0;
}

/** The amount a commitment will actually post, given what the user is considering. */
export function amountFor(r, key, sc = {}) {
  // An increase applies only on or after the date the notice says it takes effect.
  if (r.change && key >= r.change.effective) return r.amount + (sc.increase ?? 0);
  // A higher posted charge counts only once the user says it is the new price, not before.
  if (r.unexplained && sc.treatAsNewPrice?.[r.id]) return r.lastPosted;
  return r.amount;
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
export function simulate(h, sc = {}) {
  const income = sc.income || h.income;
  const start = new Date(h.today + 'T12:00:00');
  const contributionDate = income.map(p => p.date).filter(d => d >= h.today).sort()[0] ?? null;
  const monthlySpend = h.allowances.reduce((a, x) => a + x.monthly - (sc.cuts?.[x.id] || 0), 0);
  const dailySpend = monthlySpend / 30;

  const days = [];
  let balance = h.checking;

  for (let i = 0; i < h.windowDays; i++) {
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

    if (key === contributionDate && sc.contribution > 0) {
      balance -= sc.contribution;
      events.push({ label: 'Savings contribution', amt: -sc.contribution, transfer: true });
    }

    balance -= dailySpend;
    events.push({ label: 'Everyday spending', amt: -dailySpend });

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
    everyday: Math.round(month.length * dailySpend),
    savings: sc.contribution,
  };

  return { days, low, worst, dailySpend: round2(dailySpend), monthlySpend, cash, contributionDate };
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
  const today = new Date(todayIso + 'T12:00:00');
  const every = r.everyMonths || 1;
  if (every === 1) {
    const here = new Date(today.getFullYear(), today.getMonth(), r.day, 12);
    return (here >= today ? here : new Date(today.getFullYear(), today.getMonth() + 1, r.day, 12)).toISOString().slice(0, 10);
  }
  const anchor = new Date((r.anchor || todayIso) + 'T12:00:00');
  for (let i = 0; i < 240; i++) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() + i * every, r.day, 12);
    if (d >= today) return d.toISOString().slice(0, 10);
  }
  return null;
}

/** What a commitment costs per month once its cycle is taken into account. */
export const monthlyEquivalent = (r, amount = r.amount) => amount / (r.everyMonths || 1);

const money = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
