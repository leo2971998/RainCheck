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

const MERGED = ['cuts', 'cancelled', 'pendingCancel', 'treatAsNewPrice'];

/** A plan with nothing decided yet. `null` means "use the affordable/default value". */
export function emptyPlan(h) {
  const changed = h.recurring.find(r => r.change);
  return {
    increase: changed ? changed.change.to - changed.amount : 0,
    contribution: null,     // null → the contribution the forecast can carry
    goalTarget: null,       // null → the household's goal target
    goalLeft: null,         // null → the household's number of contributions
    cuts: {}, cancelled: {}, pendingCancel: {}, treatAsNewPrice: {},
    income: null,
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
      before[key] = Object.fromEntries(Object.keys(value).map(k => [k, plan[key]?.[k]]));
      next[key] = { ...plan[key], ...value };
    } else {
      before[key] = plan[key];
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
        if (v === undefined) delete merged[k]; else merged[k] = v;
      }
      next[key] = merged;
    } else {
      next[key] = value;
    }
  }
  return next;
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
  const target = plan.goalTarget ?? base.goal.target;
  const left = plan.goalLeft ?? base.goal.left;
  const income = plan.income ?? base.income;
  if (target === base.goal.target && left === base.goal.left && income === base.income) return base;
  return { ...base, income, goal: { ...base.goal, target, left } };
}
