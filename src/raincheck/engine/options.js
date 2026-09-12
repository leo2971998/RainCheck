<<<<<<< Updated upstream
import { simulate, capacity, goalAt, cutNeeded } from './forecast.js';
const FLEX_ORDER = ['dining-takeout', 'fun-other', 'rides-transit', 'household', 'groceries']; // most discretionary first

export function buildOptions(h, sc, cap, protectedIds = { groceries: true }) {
  const base = goalAt(h, cap);
  const options = [];

  // A. Keep spending, contribute what the plan supports.
  options.push({ id: 'keep', title: 'Keep everyday spending as it is', detail: `Contribute $${cap} a month instead of $${h.goal.planned}.`,
    before: ['Goal at target date', h.goal.target], after: ['Goal at target date', base.projected, base.gap ? `$${base.gap} short` : 'on target'],
    apply: { contribution: cap, label: `Plan set to $${cap}/month` } });

  // B. Trim one unprotected allowance just enough to restore the planned contribution.
  const candidates = h.allowances.filter(a => !protectedIds[a.id]).sort((a, b) => FLEX_ORDER.indexOf(a.id) - FLEX_ORDER.indexOf(b.id));
  for (const a of candidates) {
    const cut = cutNeeded(h, sc, a.id, h.goal.planned);
    if (cut !== null && cut <= a.monthly) {
      options.push({ id: 'reduce', title: `Reduce ${a.label.toLowerCase()} by $${cut} a month`, detail: `$${a.monthly} → $${a.monthly - cut}. Keeps the $${h.goal.planned} contribution.`,
        before: [a.label, a.monthly], after: ['Contribution', h.goal.planned, 'goal on target'],
        apply: { cuts: { [a.id]: cut }, contribution: h.goal.planned, label: `${a.label} trimmed $${cut}/month` } });
      break;
    }
  }

  // C. A renewal the user could cancel before it charges. Conditional until the provider confirms.
  const renewal = h.recurring.find(r => r.renews && r.renews >= h.today);
  if (renewal) {
    const capIf = capacity(h, { ...sc, cancelled: { ...sc.cancelled, [renewal.id]: true } });
    options.push({ id: 'renewal', conditional: true, title: `Review the ${renewal.label.toLowerCase()} renewal ($${renewal.amount} on ${renewal.renews.slice(5)})`,
      detail: `If cancelled before it charges, the plan supports $${capIf} a month.`, before: ['Contribution', cap], after: ['Contribution', Math.min(capIf, h.goal.planned), 'if cancelled'],
      apply: { cancelled: { [renewal.id]: true }, contribution: Math.min(capIf, h.goal.planned), label: `${renewal.label} cancellation pending` } });
  }

  // D. Keep the supported contribution, move the date.
  if (isFinite(base.monthsNeeded)) options.push({ id: 'date', title: 'Move the target date', detail: `Keep $${cap} a month and reach $${h.goal.target} after ${base.monthsNeeded} contributions instead of ${h.goal.left}.`,
    before: ['Contributions', h.goal.left], after: ['Contributions', base.monthsNeeded, `${base.monthsNeeded - h.goal.left} month(s) later`],
    apply: { contribution: cap, label: `Target moved ${base.monthsNeeded - h.goal.left} month(s) later` } });

  return options;
}
=======
import { simulate, capacity, goalPlan, dateToReach, cutNeeded, hypothetical, nextChargeDate } from './forecast.js';

const prettyDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

const FLEX_ORDER = ['dining-takeout', 'fun-other', 'rides-transit', 'household', 'groceries']; // most discretionary first

/**
 * Every option reports the SAME three outcomes, measured the same way, by running the forecast
 * under that option rather than by asserting a result:
 *
 *   contribution   what you would put aside each month
 *   low            the lowest projected checking balance in the window
 *   goal           where the goal lands, and whether it reaches the target
 *
 * Comparing a dining allowance against a savings contribution — different measures under a
 * "before and after" heading — is how a comparison misleads without saying anything false.
 */
function outcomeOf(h, sc, changes) {
  const scenario = hypothetical(sc, changes);
  const sim = simulate(h, scenario);
  const goal = goalPlan(h, scenario, { target: h.goal.target, targetDate: changes.goalDate ?? h.goal.targetDate, saved: h.goal.saved, contribution: scenario.contribution ?? sc.contribution });
  return {
    contribution: scenario.contribution ?? sc.contribution,
    low: sim.low.balance,
    lowDate: sim.low.key,
    meetsCushion: sim.low.balance >= h.cushion,
    goalProjected: goal.projected,
    goalGap: goal.gap,
    goalLeft: goal.left,
    goalDate: goal.targetDate,
    onTarget: goal.onTarget,
    // The horizon the claim rests on, in machine-readable form. Prose that says how far a plan was
    // checked should be verifiable, not taken on trust.
    checkedThrough: goal.checkedThrough,
    horizonDays: goal.horizonDays,
    assumption: goal.assumption,
  };
}

export function buildOptions(h, sc, cap, protectedIds = {}) {
  const options = [];
  const planned = h.goal.planned;

  // A. Contribute what the window can actually carry.
  options.push({
    id: 'keep',
    title: 'Keep everyday spending as it is',
    detail: `Contribute $${cap} a month instead of $${planned}.`,
    apply: { contribution: cap, label: `Plan set to $${cap}/month` },
    outcome: outcomeOf(h, sc, { contribution: cap }),
  });

  // B. Trim one unprotected allowance just enough to carry the planned contribution.
  const candidates = h.allowances.filter(a => !protectedIds[a.id]).sort((a, b) => FLEX_ORDER.indexOf(a.id) - FLEX_ORDER.indexOf(b.id));
  let trimmed = null;
  for (const a of candidates) {
    const cut = cutNeeded(h, sc, a.id, planned);
    if (cut !== null && cut <= a.monthly) { trimmed = { a, cut }; break; }
  }
  options.push(trimmed
    ? {
        id: 'reduce',
        title: `Reduce ${trimmed.a.label.toLowerCase()} by $${trimmed.cut} a month`,
        detail: `$${trimmed.a.monthly} → $${trimmed.a.monthly - trimmed.cut}, which carries the $${planned} contribution.`,
        note: 'Only allowances you have not protected are offered.',
        apply: { cuts: { [trimmed.a.id]: trimmed.cut }, contribution: planned, label: `${trimmed.a.label} trimmed $${trimmed.cut}/month` },
        outcome: outcomeOf(h, sc, { cuts: { [trimmed.a.id]: trimmed.cut }, contribution: planned }),
      }
    : { id: 'reduce', title: 'Reduce an allowance', detail: 'Every allowance is protected, so there is nothing to trim.', disabled: true });

  // C. A renewal the user could cancel. CONDITIONAL: accepting this records an intent and does not
  //    touch the forecast, because the provider has not done anything yet. The numbers below are
  //    what it WOULD be worth, and the Recurring page is where a confirmed cancellation is recorded.
  const renewal = h.recurring
    .map(r => ({ ...r, dueOn: nextChargeDate(r, h.today) }))   // shared with the bill list and the forecast
    .filter(r => r.cancellable && r.dueOn && !sc.cancelled?.[r.id])
    .sort((a, b) => b.amount - a.amount)[0];
  if (renewal) {
    const capIf = capacity(h, hypothetical(sc, { cancelled: { [renewal.id]: true } }));
    options.push({
      id: 'renewal',
      conditional: true,
      title: `Cancel the ${renewal.label.toLowerCase()} before it renews`,
      detail: `$${renewal.amount} is due on ${prettyDate(renewal.dueOn)}. If you cancel and the provider confirms, the plan would carry $${Math.min(capIf, planned)} a month.`,
      note: 'Accepting this records your intention. Your forecast will not change until you confirm the cancellation went through.',
      apply: { pendingCancel: { [renewal.id]: true }, label: `${renewal.label} cancellation pending confirmation` },
      outcome: outcomeOf(h, sc, { cancelled: { [renewal.id]: true }, contribution: Math.min(capIf, planned) }),
    });
  }

  // D. Keep the spending, and let the goal take the time it actually needs.
  const reach = dateToReach(h, sc, { target: h.goal.target, saved: h.goal.saved, contribution: cap });
  if (reach.date && reach.date !== h.goal.targetDate) {
    options.push({
      id: 'date',
      title: 'Give the goal more time',
      detail: `Keep $${cap} a month — which your plan already carries — and reach $${h.goal.target} by ${prettyDate(reach.date)} instead.`,
      apply: { contribution: cap, goalDate: reach.date, label: `Target moved to ${prettyDate(reach.date)}` },
      outcome: outcomeOf(h, sc, { contribution: cap, goalDate: reach.date }),
    });
  }

  return options;
}

/** The plan as it stands today, so the comparison has a row to measure against. */
export function currentOutcome(h, sc) {
  return { id: 'current', title: 'Your current plan', ...outcomeOf(h, sc, {}) };
}
>>>>>>> Stashed changes
