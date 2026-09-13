import { goalPlan } from './forecast.js';
import { needsBillReview } from './bill-reviews.js';

const short = date => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const shortIso = iso => short(new Date(iso + 'T12:00:00'));
const monthName = iso => new Date(`${iso.slice(0, 7)}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long' });
// Signed. Math.abs() here turned a $200 shortfall into "would leave $200", which read as
// though the money were still there.
const $ = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

/**
 * What deserves to interrupt the user.
 *
 * The rule is one event, one alert. A bill change and the cushion breach it causes are the same
 * event, so the breach is folded into that alert's body rather than sent as a second one. Two
 * genuinely different events — a saved budget estimate, and a recorded charge that differs from
 * earlier payments — are separate alerts, because they need different decisions from the user.
 *
 * Everything here is a consequence the user can act on. Spending trends belong in a weekly
 * summary, not an interruption.
 */
export function buildAlerts(h, sc, sim, cap, lastAction, datedGoal) {
  const accepted = sc.contribution != null && sc.contribution <= cap;
  const alerts = [];
  const goal = datedGoal ?? goalPlan(h, sc, { ...h.goal, contribution: sc.contribution });
  const fits = sc.contribution <= cap;
  const breach = sim.worst === 'over' || sim.worst === 'below';

  // The cushion breach, phrased once, to be attached to whichever event explains it.
  const breachSentence = breach
    ? (sim.low.balance < 0
      ? `Your planned ${$(sc.contribution)} contribution would overdraw you by ${$(Math.abs(sim.low.balance))} on ${short(sim.low.date)}.`
      : `Your planned ${$(sc.contribution)} contribution would leave ${$(sim.low.balance)} on ${short(sim.low.date)}, below your ${$(h.cushion)} cushion.`)
    : null;
  const goalSentence = [goal.gap ? `Your current savings plan would end ${$(goal.gap)} short by ${shortIso(goal.targetDate)}.` : null,
    !goal.fits ? 'The planned contributions do not keep your checking target intact through the goal deadline.' : null].filter(Boolean).join(' ');
  let breachExplained = false;

  // --- 1. A saved bill estimate affects the plan. This is not proof of a company price change. ---
  for (const bill of h.recurring.filter(r => r.change)) {
    const increase = sc.increase ?? bill.change.increase;
    if (!increase || accepted) continue;      // once the plan carries itself, this is no longer news
    breachExplained = true;
    alerts.push({
      id: `increase:${bill.id}`,
      tone: breach ? 'bad' : 'warn',
      amount: sc.whatIf?.[bill.id] ?? bill.change.to,
      metricLabel: 'planned bill estimate',
      title: `${bill.payee || bill.label}: review your saved bill estimate.`,
      body: [`Your plan uses ${$(sc.whatIf?.[bill.id] ?? bill.change.to)} instead of ${$(bill.amount)}. This is a planning estimate, not a new bank charge.`, breachSentence].filter(Boolean).join(' '),
      actions: [
        { label: 'Review estimate & notes', target: 'bill', billId: bill.id, primary: true },
        { label: 'Compare options', target: 'compare' },
      ],
    });
  }

  // --- 2. A charge differs from earlier charges and nothing explains it. ---
  // This is NOT called a price change. It is a question for the user, and the forecast does not
  // move until they answer it.
  for (const bill of h.recurring.filter(r => r.unexplained)) {
    if (!needsBillReview(bill, sc)) continue;
    const usual = bill.usual ?? bill.amount;
    const gap = bill.lastPosted - usual;
    alerts.push({
      id: `unexplained:${bill.id}`,
      tone: 'warn',
      amount: bill.lastPosted,
      metricLabel: 'posted charge',
      title: `${bill.payee || bill.label}: payment ${$(Math.abs(gap))} ${gap < 0 ? 'lower' : 'higher'} than usual.`,
      body: `${$(bill.lastPosted)} posted${bill.lastPostedDate ? ` on ${shortIso(bill.lastPostedDate)}` : ''}, against a usual ${$(usual)}. We have not confirmed why.`
        + ' Ask the company about the difference and keep notes.',
      actions: [{ label: 'Review charge', target: 'anomaly', billId: bill.id, primary: true }],
    });
  }

  // --- 3. The cushion is breached and no change above accounts for it. ---
  if (breach && !breachExplained) {
    const lowMonth = sim.low.key?.slice(0, 7);
    const monthPurchases = lowMonth ? (h.plannedPurchases || []).filter(p => p.status === 'planned'
      && (p.date < h.today ? h.today : p.date).slice(0, 7) === lowMonth) : [];
    const plannedTotal = monthPurchases.reduce((sum, purchase) => sum + purchase.amount, 0);
    alerts.push({
      id: 'cushion',
      tone: 'bad',
      amount: sim.low.balance,
      metricLabel: 'projected balance',
      title: monthPurchases.length ? `${monthName(`${lowMonth}-01`)} plan needs attention.` : `Projected balance falls to ${$(sim.low.balance)} on ${short(sim.low.date)}.`,
      body: (monthPurchases.length ? `You have ${$(plannedTotal)} in planned purchases in ${monthName(`${lowMonth}-01`)}. ` : '')
        + `Checking is projected at ${$(sim.low.balance)} on ${short(sim.low.date)}, below your ${$(h.cushion)} cushion before your next paycheck.`
        + (!fits ? ` Your plan supports ${$(cap)} a month rather than the ${$(sc.contribution)} you have scheduled.` : '')
        + (goalSentence ? ` ${goalSentence}` : ''),
      actions: monthPurchases.length
        ? [{ label: 'Review planned purchases', target: 'page:purchases', primary: true }, { label: 'Compare options', target: 'compare' }]
        : [{ label: 'Compare options', target: 'compare', primary: true }],
    });
  }

  // A goal can fall short even when the near-term checking forecast is comfortable.
  // Use the current dated goal, not the original sample's contribution count.
  if (!breach && !breachExplained && (goal.gap > 0 || !goal.fits)) {
    alerts.push({
      id: 'goal', tone: 'warn', amount: goal.gap, metricLabel: 'goal gap', title: goal.shared ? 'Your savings plan needs an adjustment.'
        : `${h.goal.label} needs a plan adjustment.`,
      body: `${goalSentence} Review the monthly saving amount, costs, or deadline.`,
      actions: [{ label: 'Review goal', target: 'page:goals', primary: true },
        { label: 'Compare options', target: 'compare' }],
    });
  }

  // --- 4. Confirmation of what the user chose, and what it did not do. ---
  if (lastAction) {
    alerts.push({
      id: 'applied',
      tone: 'good',
      title: 'Plan updated.',
      body: lastAction.label,
      actions: [{ label: 'View savings', target: 'page:cashflow' }],
    });
  }

  const rank = { bad: 0, warn: 1, good: 2 };
  return alerts.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
