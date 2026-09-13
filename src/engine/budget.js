import { applyPatch, householdFor, scenarioFor } from './plan.js';
import { simulate, goalPlan, monthlyEquivalent, round2, nextChargeDate, amountFor } from './forecast.js';

export const BASE_GOAL = 'emergency-fund';
export function planningLimit(today) {
  const d = new Date(today + 'T12:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + 2);
  return d.toISOString().slice(0, 10);
}
function name(value) {
  const text = String(value ?? '').trim();
  if (!text || text.length > 60 || /[\u0000-\u001f<>]/.test(text)) throw new Error('Enter a name of 1–60 characters.');
  return text;
}
function money(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value)) || !(Number(value) > 0) || Number(value) > 1000000)
    throw new Error('Enter an amount between $0.01 and $1,000,000, with up to two decimal places.');
  return Number(value);
}
function date(value, today, future = false) {
  const parsed = new Date(value + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value
    || value < today || (future && value === today) || value > planningLimit(today))
    throw new Error(`Choose a valid ${future ? 'future ' : ''}date within the next two years of the forecast date (${today}).`);
  return value;
}
export function readGoal(draft, today) {
  return { label: name(draft.label), target: money(draft.target), targetDate: date(draft.targetDate, today, true) };
}
export function readSubscription(draft, today) {
  const startsOn = date(draft.startsOn, today);
  return { label: name(draft.label), amount: money(draft.amount), startsOn, day: Number(startsOn.slice(8)),
    everyMonths: 1, freq: 'Monthly', budgetOnly: true, cancellable: false };
}
export function goalChoices(base, plan) {
  return [{ ...base.goal, ...plan.goals?.[BASE_GOAL], id: BASE_GOAL }, ...Object.entries(plan.goals || {})
    .filter(([id, item]) => item && id !== BASE_GOAL).map(([id, item]) => ({ ...item, id }))];
}
export function goalPatch(id, item, contribution) {
  return { goals: { [id]: item },
    goalId: id, goalTarget: item.target, goalDate: item.targetDate, contribution };
}
export function removeGoalPatch(base, plan, id) {
  if (id === BASE_GOAL) throw new Error('The starting goal stays available.');
  const fallback = goalChoices(base, plan)[0];
  return { ...(plan.goalId === id ? goalPatch(BASE_GOAL, fallback, base.goal.planned) : {}), goals: { [id]: null } };
}
export function subscriptionPatch(id, item) {
  if (!/^sub-[a-z0-9-]+$/.test(id)) throw new Error('Only budget subscriptions can be changed here.');
  return { subscriptions: { [id]: item ? { ...item, id } : null } };
}
function outcome(base, plan) {
  const h = householdFor(base, plan), sc = scenarioFor(h, plan);
  const sim = simulate(h, sc);
  const g = goalPlan(h, sc, { ...h.goal, contribution: sc.contribution });
  return { low: sim.low.balance, lowDate: sim.low.key, state: sim.worst, cushion: h.cushion,
    plannedPurchases: round2(sim.days.flatMap(d => d.events).filter(e => e.purchase).reduce((s, e) => s - e.amt, 0)),
    monthlyBills: round2(h.recurring.filter(r => !sc.cancelled?.[r.id]).reduce((s, r) => s + monthlyEquivalent(r, amountFor(r, nextChargeDate(r, h.today), sc)), 0)),
    goalLabel: h.goal.label, target: g.target, saved: g.saved, targetDate: g.targetDate, projected: g.projected,
    gap: g.gap, supported: g.supported, contribution: g.contribution, required: g.required,
    fits: g.fits, feasible: g.feasible, checkedThrough: g.checkedThrough };
}
export function budgetImpact(base, plan, patch) {
  const before = outcome(base, plan), after = outcome(base, applyPatch(plan, patch).plan);
  return { asOf: base.today, cushion: after.cushion, beforeCushion: before.cushion, windowDays: base.windowDays,
    before, after };
}
