/**
 * What two goals with two deadlines actually ask of you, month by month.
 *
 * A single monthly figure is a lie once the deadlines differ. Saving $300 for an emergency fund
 * due in December and $120 for a laptop due next June is $420 a month — but only until December.
 * After that it is $120, and the person planning around it needs to know that before they commit,
 * not in January when the number moves on its own.
 *
 * Nothing here re-plans anything. `goalPayments` already dates every contribution and stops it at
 * the goal's own target amount or deadline, whichever comes first; this groups that schedule into
 * the runs a person would actually say out loud, and works out the arithmetic of a missed date.
 */

const round2 = n => Math.round(n * 100) / 100;
const monthKey = iso => iso.slice(0, 7);

/** What a month asks for, as a comparable string, so identical months collapse into one run. */
const shapeOf = month => month.total.toFixed(2) + '|'
  + month.parts.map(p => p.label + ':' + p.amount.toFixed(2)).sort().join(',');

/**
 * The plan as consecutive stretches that ask for the same thing.
 * One goal gives one run. Two goals with different deadlines give a run per step down.
 */
export function savingsRuns(goal) {
  const byMonth = new Map();
  for (const payment of goal?.payments ?? []) {
    const key = monthKey(payment.date);
    const month = byMonth.get(key) ?? { key, total: 0, parts: new Map() };
    month.total = round2(month.total + payment.amount);
    month.parts.set(payment.label, round2((month.parts.get(payment.label) ?? 0) + payment.amount));
    byMonth.set(key, month);
  }
  const months = [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key))
    .map(m => ({ key: m.key, total: m.total, parts: [...m.parts].map(([label, amount]) => ({ label, amount })) }));

  const runs = [];
  for (const month of months) {
    const shape = shapeOf(month), last = runs.at(-1);
    if (last && last.shape === shape) { last.to = month.key; last.months += 1; continue; }
    runs.push({ from: month.key, to: month.key, months: 1, total: month.total, parts: month.parts, shape });
  }
  return runs;
}

/**
 * Per goal: what the deadline asks for, what the plan puts in, and — when those differ — when the
 * plan would actually get there. The late date is the honest version of "$200 short": a shortfall
 * against a date is really a date that moves.
 */
export function goalMath(goal) {
  return (goal?.goals ?? []).map(g => {
    const remaining = round2(Math.max(0, g.target - g.saved));
    const planned = g.contribution ?? 0;
    const needed = Number.isFinite(g.required) ? g.required : null;
    const done = remaining === 0;
    const short = round2(g.gap ?? 0);
    return {
      ...g, remaining, planned, needed, done, short,
      progress: g.target > 0 ? Math.min(1, g.saved / g.target) : 0,
      onTrack: done || short === 0,
      extra: needed == null || done ? null : round2(Math.max(0, needed - planned)),
      finish: done ? null : finishDate(g, remaining, planned),
    };
  });
}

/** When the current monthly amount would reach the target, whatever the deadline says. */
function finishDate(g, remaining, planned) {
  if (!(planned > 0)) return null;
  const first = g.schedule?.[0] ?? g.payments?.[0]?.date;
  if (!first) return null;
  const months = Math.ceil(Math.round(remaining * 100) / Math.round(planned * 100));
  const start = new Date(first + 'T12:00:00Z');
  const y = start.getUTCFullYear(), m = start.getUTCMonth() + months - 1;
  const day = Math.min(start.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  return new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
}

/** Whole months a date slips by, for saying "about four months later" rather than a bare date. */
export function monthsLate(finish, targetDate) {
  if (!finish || !targetDate || finish <= targetDate) return 0;
  const a = new Date(targetDate + 'T12:00:00Z'), b = new Date(finish + 'T12:00:00Z');
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/**
 * The combined ask against what the forecast supports. `supported` is a search over the
 * simulation, so this compares a required total with a figure that has already been checked
 * against every bill and paycheck — not with a rule of thumb.
 */
export function combinedMath(goal, math) {
  const needed = math.some(g => g.needed == null) ? null
    : round2(math.reduce((sum, g) => sum + (g.done ? 0 : g.needed), 0));
  const planned = round2(math.reduce((sum, g) => sum + g.planned, 0));
  const supported = goal?.supported ?? null;
  return {
    needed, planned, supported,
    affordable: needed == null || supported == null ? null : needed <= supported,
    over: needed == null || supported == null ? 0 : round2(Math.max(0, needed - supported)),
  };
}
