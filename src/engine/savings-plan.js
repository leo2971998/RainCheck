import { householdFor, scenarioFor } from './plan.js';
import { budgetImpact } from './budget.js';
import { currentFunding, fundedGoals, goalCatalog, monthlyGoalDates, validateFunding } from './goal-funding.js';
import { spendingInsights } from './spending-insights.js';
import { simulate, round2, scheduleUntil } from './forecast.js';
import { recoveryObjective, recoveryProjection } from './budget-recovery.js';

/** Deadline arithmetic, separate from whether checking can afford those contributions. */
export function savingsNeeds(base, plan, extras = {}) {
  const h = householdFor(base, plan), sc = scenarioFor(h, plan);
  return fundedGoals(base, plan).filter(g => g.saved < g.target).map(g => {
    const remaining = round2(g.target - g.saved);
    const income = sc.income || h.income;
    const dates = !income.some(p => p.date >= h.today) ? [] : h.fundedGoals
      ? monthlyGoalDates(income, h.today, g.targetDate) : scheduleUntil(h, g.targetDate);
    const paymentsLeft = dates.length;
    const needed = paymentsLeft ? Math.ceil(Math.round(remaining * 100) / paymentsLeft) / 100 : null;
    const extraNeeded = needed == null ? null : round2(Math.max(0, needed - g.planned));
    return { id: g.id, label: g.label, targetDate: g.targetDate, remaining, paymentsLeft,
      needed, planned: g.planned, extraNeeded,
      remainingNeeded: extraNeeded == null ? null : round2(Math.max(0, extraNeeded - Number(extras[g.id] || 0))) };
  });
}

/** Candidate limits from recorded categories; AI must review these before the editor opens. */
export function optimizationDraft(base, plan, protectedIds = {}) {
  const h = householdFor(base, plan), data = spendingInsights(h, scenarioFor(h, plan), protectedIds);
  if (!data.available) throw new Error('Load spending history before optimizing budgets.');
  const draft = { targets: Object.fromEntries(data.categories.map(c => [c.id,
    round2(c.budget - (c.over > 0 ? 0 : c.suggestedCut))])), extras: {},
    recovery: recoveryObjective(h, data, savingsNeeds(base, plan)) };
  const preview = savingsPreview(base, plan, draft, protectedIds);
  const need = preview.guidance.additionalNeeded;
  // Offer the existing monthly goals together, never silently prioritize one or move saved money.
  if (need > 0 && need <= preview.freed) {
    const extras = Object.fromEntries(preview.guidance.goals.filter(g => g.extraNeeded > 0).map(g => [g.id, g.extraNeeded]));
    const withGoals = { ...draft, extras };
    if (savingsPreview(base, plan, withGoals, protectedIds).canApply) return withGoals;
  }
  return draft;
}

const cents = value => {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !/^\d+(\.\d{1,2})?$/.test(value)))
    throw new Error('Enter a numeric amount with up to two decimal places.');
  const n = Number(value);
  if (value === '' || typeof value === 'boolean' || value == null || !Number.isFinite(n) || n < 0 || n > 1000000
    || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw new Error('Use a positive amount or zero, with up to two decimal places.');
  return Math.round(n * 100);
};
function entries(value = {}) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length > 50) throw new Error('Choose valid category and goal amounts.');
  return Object.entries(value);
}

/** One reversible proposal. Reducing a budget never increases actual saved balances. */
export function savingsPreview(base, plan, draft, protectedIds = {}) {
  const h = householdFor(base, plan), sc = scenarioFor(h, plan);
  const patch = { cuts: {} }, changes = [], goalChanges = [];
  let freedCents = 0, extraCents = 0;
  for (const [id, value] of entries(draft.targets)) {
    const a = h.allowances.find(a => a.id === id);
    if (!a) throw new Error('Only flexible spending categories can be adjusted here.');
    const target = cents(value), baseline = cents(a.monthly), current = Math.max(0, baseline - cents(sc.cuts?.[id] || 0));
    if (target > baseline) throw new Error(`Keep ${a.label} at or below its usual estimate of $${a.monthly}.`);
    if (protectedIds[id] && target < current) throw new Error(`${a.label} is protected. Unprotect it before proposing a reduction.`);
    if (target === current) continue;
    patch.cuts[id] = (baseline - target) / 100;
    freedCents += current - target;
    changes.push({ id, label: a.label, before: current / 100, after: target / 100, freed: (current - target) / 100 });
  }
  const funding = currentFunding(base, plan), catalog = goalCatalog(base, plan), nextFunding = { ...funding };
  for (const [id, value] of entries(draft.extras)) {
    const extra = cents(value);
    if (!extra) continue;
    const f = funding[id], goal = catalog[id];
    if (!f?.active || !goal || f.saved >= goal.target || goal.targetDate < base.today)
      throw new Error('Choose an active, unfinished savings goal.');
    nextFunding[id] = { ...f, monthly: (cents(f.monthly) + extra) / 100 };
    goalChanges.push({ id, label: goal.label, before: f.monthly, after: nextFunding[id].monthly, extra: extra / 100 });
    extraCents += extra;
  }
  if (extraCents > Math.max(0, freedCents)) throw new Error('Planned extra savings cannot exceed the money this proposal frees up.');
  if (extraCents) {
    Object.assign(patch, { goals: catalog, goalFunding: nextFunding, goalId: null, contribution: null, goalTarget: null, goalDate: null });
    validateFunding(base, { ...plan, ...patch });
  }
  const impact = budgetImpact(base, plan, patch);
  const data = spendingInsights(h, sc, protectedIds), goals = savingsNeeds(base, plan, draft.extras);
  const sumNeed = key => goals.some(g => g[key] == null) ? null : round2(goals.reduce((sum, g) => sum + g[key], 0));
  const additionalNeeded = sumNeed('extraNeeded');
  // Reuse dated spending events, rather than crediting a full month's reduction partway through it.
  const days = new Date(Number(h.today.slice(0, 4)), Number(h.today.slice(5, 7)), 0).getDate() - Number(h.today.slice(8)) + 1;
  const spending = scenario => simulate(h, scenario, { days }).days.flatMap(d => d.events)
    .filter(e => e.everyday).reduce((sum, e) => sum - e.amt, 0);
  const thisMonthReduction = round2(spending(sc) - spending({ ...sc, cuts: { ...sc.cuts, ...patch.cuts } }));
  const recovery = recoveryProjection(h, sc, { ...sc, cuts: { ...sc.cuts, ...patch.cuts } }, draft.recovery, extraCents / 100);
  return { patch, changes, goalChanges, impact, freed: freedCents / 100, extraSavings: extraCents / 100,
    remainingInChecking: (freedCents - extraCents) / 100, hasChanges: changes.length > 0 || extraCents > 0,
    canApply: !extraCents || impact.after.fits,
    guidance: { goals, additionalNeeded, remainingNeeded: sumNeed('remainingNeeded'), thisMonthReduction, recovery,
      uncoveredByCuts: additionalNeeded == null ? null : round2(Math.max(0, additionalNeeded - Math.max(0, freedCents / 100))),
      overBudget: data.categories.filter(c => c.over > 0).map(({ id, label, spent, budget, over }) => ({ id, label, spent, budget, over })) } };
}
