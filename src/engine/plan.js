// src/engine/plan.js
//
// One accepted plan, and a history of the changes that built it.
//
// These used to be the same object: whatever the user last applied both described the action AND
// determined the plan. So recording a gym cancellation silently reverted an accepted goal
// extension, applying an extension after editing the goal was ignored, and Undo restored a whole
// earlier snapshot, taking unrelated decisions with it.
//
// Now the plan holds every decision, each change records only the fields it touched, and Undo
// reverses exactly those fields.

// "this key did not exist before" has to be representable in JSON. `undefined` is dropped by
// JSON.stringify, so a reloaded history entry forgot that Undo should REMOVE a newly added key —
// a first cancellation or imported change survived its own undo.
const ABSENT = '__raincheck_absent__';

const MERGED = ['cuts', 'cancelled', 'pendingCancel', 'treatAsNewPrice', 'whatIf', 'billChanges', 'paid', 'adopted', 'dismissed', 'goals', 'subscriptions'];

/** A plan with nothing decided yet. `null` means "use the affordable/default value". */
export function emptyPlan() {
  return {
    contribution: null,     // null → the contribution the forecast can carry
    goalTarget: null,       // null → the household's goal target
    goalDate: null,         // null → the household's target date
    cuts: {}, cancelled: {}, pendingCancel: {}, treatAsNewPrice: {},
    whatIf: {},             // billId → an amount the user typed, overriding that bill's notice
    billChanges: {},        // billId → a change imported from a notice the user pasted
    paid: {},               // billId → the 'YYYY-MM' cycle the user confirmed paid
    adopted: {},            // id → a commitment found in spending that the user confirmed
    dismissed: {},          // id → a proposal the user rejected, so it is not offered again
    income: null,
    goalId: null, goals: {}, subscriptions: {},
  };
}

/**
 * Apply a patch and return the next plan plus a history entry that can reverse it.
 * Scalars replace; the object fields merge, so trimming dining does not forget a cancelled gym.
 */
export function applyPatch(plan, patch, label = '') {
  const next = { ...plan };
  const before = {};

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'label') continue;
    if (MERGED.includes(key)) {
      before[key] = Object.fromEntries(Object.keys(value).map(k => [k, k in (plan[key] || {}) ? plan[key][k] : ABSENT]));
      next[key] = { ...plan[key], ...value };
    } else {
      before[key] = key in plan ? plan[key] : ABSENT;
      next[key] = value;
    }
  }
  return { plan: next, entry: { label, at: Date.now(), before } };
}

/** Reverse one change, leaving every decision made before or since it alone. */
export function revert(plan, entry) {
  if (!entry) return plan;
  const next = { ...plan };
  for (const [key, value] of Object.entries(entry.before)) {
    if (MERGED.includes(key)) {
      const merged = { ...plan[key] };
      for (const [k, v] of Object.entries(value)) {
        if (v === ABSENT || v === undefined) delete merged[k]; else merged[k] = v;
      }
      next[key] = merged;
    } else {
      if (value === ABSENT) delete next[key]; else next[key] = value;
    }
  }
  return next;
}

/** Reject stale notification actions rather than undoing a newer, unrelated decision. */
export function undoLatest(plan, history, expectedAt = null) {
  const entry = history[history.length - 1];
  if (!entry || (expectedAt != null && entry.at !== expectedAt)) return null;
  return { plan: revert(plan, entry), history: history.slice(0, -1) };
}

/** The scenario the forecast runs on: the plan, with the scheduled contribution filled in. */
export function scenarioFor(h, plan) {
  return { ...plan, contribution: plan.contribution ?? h.goal.planned };
}

/**
 * The household as the user has told us it is: their goal, and any paycheck they have corrected.
 *
 * Edited income has to live HERE rather than only in the scenario. When it did not, the forecast
 * moved the contribution to the corrected payday while the goal schedule still listed the old one,
 * so two screens disagreed about the same date.
 */
export function householdFor(base, plan) {
  const selected = plan.goals?.[plan.goalId] || base.goal;
  const target = plan.goalTarget ?? selected.target;
  const targetDate = plan.goalDate ?? selected.targetDate;
  const income = plan.income ?? base.income;
  const imported = plan.billChanges || {};

  // A notice the user imported attaches to the bill it names. Importing a second notice for the
  // same bill REPLACES the first, so re-importing can never stack two increases on one commitment.
  const recurring = Object.keys(imported).length
    ? base.recurring.map(r => (imported[r.id] ? { ...r, change: imported[r.id] } : r))
    : base.recurring;

  // Commitments the user confirmed from their spending history join the bill list. Nothing
  // reaches the forecast until they say so; a proposal on its own changes nothing.
  const adopted = Object.values(plan.adopted || {});
  const newlyAdopted = adopted.filter(a => !recurring.some(r => r.id === a.id));
  const subscriptions = Object.values(plan.subscriptions || {}).filter(Boolean);
  const withAdopted = newlyAdopted.length || subscriptions.length
    ? [...recurring, ...newlyAdopted, ...subscriptions].sort((a, b) => a.day - b.day)
    : recurring;

  // Those charges were ALREADY inside a spending category, because they were purchases. Adding the
  // commitment without taking them out counts the same money twice and invents an expense the user
  // never incurred. Take the share back out of the category it came from.
  let allowances = base.allowances;
  if (newlyAdopted.length) {
    const reclaim = {};
    for (const a of newlyAdopted) if (a.categoryId) reclaim[a.categoryId] = (reclaim[a.categoryId] || 0) + (a.monthlyShare ?? a.amount);
    allowances = base.allowances.map(x =>
      reclaim[x.id] ? { ...x, monthly: Math.max(0, Math.round(x.monthly - reclaim[x.id])), reclaimed: reclaim[x.id] } : x);
  }

  const unchanged = selected === base.goal && target === base.goal.target && targetDate === base.goal.targetDate
    && income === base.income && withAdopted === base.recurring && allowances === base.allowances;
  if (unchanged) return base;
  return { ...base, income, recurring: withAdopted, allowances, goal: { ...base.goal, label: selected.label, target, targetDate } };
}
