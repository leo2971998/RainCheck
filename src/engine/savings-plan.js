import { householdFor, scenarioFor } from './plan.js';
import { budgetImpact } from './budget.js';
import { currentFunding, goalCatalog, validateFunding } from './goal-funding.js';
import { spendingInsights } from './spending-insights.js';

/** Candidate limits from recorded categories; AI must review these before the editor opens. */
export function optimizationDraft(base, plan, protectedIds = {}) {
  const h = householdFor(base, plan), data = spendingInsights(h, scenarioFor(h, plan), protectedIds);
  if (!data.available) throw new Error('Load spending history before optimizing budgets.');
  return { targets: Object.fromEntries(data.categories.map(c => [c.id,
    Math.round((c.budget - c.suggestedCut) * 100) / 100])), extras: {} };
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
  return { patch, changes, goalChanges, impact, freed: freedCents / 100, extraSavings: extraCents / 100,
    remainingInChecking: (freedCents - extraCents) / 100, hasChanges: changes.length > 0 || extraCents > 0,
    canApply: !extraCents || impact.after.fits };
}
