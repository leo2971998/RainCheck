import { simulate, round2 } from './forecast.js';
import { spendingDayDivisor } from './purchases.js';
import { planningLimit } from './budget.js';

/** Recovery is a future spending objective, not a second charge or a bank transfer. */
export function recoveryProjection(h, sc, afterSc, objective, extraSavings = 0) {
  if (!objective) return null;
  const { deadline } = objective, amount = Number(objective.amount);
  if (objective.amount === '' || !Number.isFinite(amount) || amount < 0 || amount > 1000000
    || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) throw new Error('Enter a recovery amount with up to two decimal places.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline || '') || !Number.isFinite(Date.parse(deadline))
    || new Date(deadline).toISOString().slice(0, 10) !== deadline || deadline < h.today || deadline > planningLimit(h.today))
    throw new Error('Choose a recovery date within the next two years.');
  if (!amount) return null;
  const maxDate = planningLimit(h.today);
  const days = Math.round((Date.parse(maxDate) - Date.parse(h.today)) / 864e5) + 1;
  const before = simulate(h, sc, { days }), after = simulate(h, afterSc, { days });
  const spending = d => -d.events.filter(e => e.everyday).reduce((s, e) => s + e.amt, 0);
  let projected = 0, cumulative = 0, factor = 0, laterDate = null;
  for (let i = 0; i < before.days.length; i++) {
    const d = before.days[i], share = 1 / spendingDayDivisor(h, d.key);
    // Money assigned to extra goal contributions cannot also rebuild the recovery amount.
    cumulative += spending(d) - spending(after.days[i]) - extraSavings * share;
    if (d.key <= deadline) { projected = cumulative; factor += share; }
    if (laterDate === null && cumulative >= amount - .005) laterDate = d.key;
  }
  projected = round2(Math.max(0, projected));
  const remaining = round2(Math.max(0, amount - projected));
  return { amount, deadline, projected, remaining, complete: remaining === 0,
    requiredMonthly: Math.ceil((amount / factor - 1e-8) * 100) / 100,
    extraMonthlyNeeded: Math.ceil((remaining / factor - 1e-8) * 100) / 100,
    laterDate: laterDate && laterDate > deadline ? laterDate : null };
}

export function recoveryObjective(h, data, goals) {
  const amount = round2(data.categories.reduce((sum, c) => sum + c.over, 0));
  if (!amount) return null;
  const fallback = new Date(h.today + 'T12:00:00Z');
  fallback.setUTCMonth(fallback.getUTCMonth() + 4, 0);
  return { amount, deadline: goals.map(g => g.targetDate).filter(d => d >= h.today).sort().at(-1)
    || fallback.toISOString().slice(0, 10) };
}
