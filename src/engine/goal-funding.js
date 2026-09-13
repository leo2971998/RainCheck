// Goal allocations are planning envelopes, not additional bank balances.
export const STARTING_GOAL = 'emergency-fund';
const cents = n => Math.round(n * 100);
const sum = values => values.reduce((a, n) => a + cents(n), 0) / 100;

export function goalCatalog(base, plan) {
  const catalog = { [STARTING_GOAL]: base.goal, ...plan.goals };
  if (plan.goalFunding == null) {
    const id = plan.goalId || STARTING_GOAL;
    catalog[id] = { ...(catalog[id] || base.goal), target: plan.goalTarget ?? catalog[id]?.target ?? base.goal.target,
      targetDate: plan.goalDate ?? catalog[id]?.targetDate ?? base.goal.targetDate };
  }
  return catalog;
}

export function currentFunding(base, plan) {
  if (plan.goalFunding != null) return plan.goalFunding;
  return { [plan.goalId || STARTING_GOAL]: { monthly: plan.contribution ?? base.goal.planned,
    saved: base.goal.saved, active: true } };
}

export function validateFunding(base, plan) {
  const catalog = goalCatalog(base, plan);
  const entries = Object.entries(plan.goalFunding || {});
  if (entries.length > 20) throw new Error('Keep up to 20 goals in this plan.');
  for (const [id, f] of entries) {
    if (f === null) continue;
    if (!catalog[id] || !f || Object.keys(f).some(k => !['monthly', 'saved', 'active'].includes(k))
      || typeof f.active !== 'boolean') throw new Error('Choose a valid goal and funding status.');
    for (const key of ['monthly', 'saved']) {
      const n = f[key];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1000000 || Math.abs(n * 100 - cents(n)) > 1e-6)
        throw new Error('Use a valid savings amount with up to two decimal places.');
    }
    if (f.saved > catalog[id].target) throw new Error('Allocated savings cannot exceed the goal amount.');
  }
  if (sum(entries.filter(([, f]) => f).map(([, f]) => f.saved)) > base.savings)
    throw new Error('These savings are already allocated. Use only the savings available in your account.');
}

export function fundedGoals(base, plan) {
  const catalog = goalCatalog(base, plan);
  return Object.entries(currentFunding(base, plan)).filter(([id, f]) => f && f.active && catalog[id])
    .map(([id, f]) => ({ ...catalog[id], id, saved: f.saved, planned: f.monthly }));
}

export function combinedGoal(base, goals) {
  return { ...base.goal, label: goals.length === 1 ? goals[0].label : 'All savings goals',
    target: sum(goals.map(g => g.target)), saved: sum(goals.map(g => g.saved)),
    planned: sum(goals.filter(g => g.saved < g.target).map(g => g.planned)),
    targetDate: goals.map(g => g.targetDate).sort().at(-1) || base.goal.targetDate };
}

export function monthlyGoalDates(income, today, throughDate) {
  const first = income.map(p => p.date).filter(d => d >= today).sort()[0];
  if (!first) return [];
  const anchor = new Date(first + 'T12:00:00Z');
  const dates = [];
  for (let i = 0; i < 25; i++) {
    const y = anchor.getUTCFullYear(), m = anchor.getUTCMonth() + i;
    const day = Math.min(anchor.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
    const date = new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
    if (date > throughDate) break;
    dates.push(date);
  }
  return dates;
}

/** Dated, cent-exact payments. A completed goal cannot keep draining checking. */
export function goalPayments(h, sc, throughDate) {
  const dates = monthlyGoalDates(sc.income || h.income, h.today, throughDate);
  const payments = [];
  for (const goal of h.fundedGoals) {
    let remaining = Math.max(0, cents(goal.target) - cents(goal.saved));
    for (const date of dates) {
      if (date > goal.targetDate || remaining <= 0 || goal.planned <= 0) break;
      const amount = Math.min(remaining, cents(goal.planned));
      payments.push({ date, amount: amount / 100, goalId: goal.id, label: goal.label });
      remaining -= amount;
    }
  }
  return payments.sort((a, b) => a.date.localeCompare(b.date));
}
