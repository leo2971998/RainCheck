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
