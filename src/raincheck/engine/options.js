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
