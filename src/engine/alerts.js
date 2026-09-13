import { goalPlan } from './forecast.js';
import { needsBillReview } from './bill-reviews.js';

const short = date => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const shortIso = iso => short(new Date(iso + 'T12:00:00'));
// Signed. Math.abs() here turned a $200 shortfall into "would leave $200", which read as
// though the money were still there.
const $ = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

/**
 * What deserves to interrupt the user.
 *
 * The rule is one event, one alert. A bill change and the cushion breach it causes are the same
 * event, so the breach is folded into that alert's body rather than sent as a second one. Two
 * genuinely different events — a provider raising a price, and a charge arriving higher with no
 * explanation — are separate alerts, because they need different decisions from the user.
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

  // --- 1. A provider says the price is going up. We can quote the sentence that proves it. ---
  for (const bill of h.recurring.filter(r => r.change)) {
    const increase = sc.increase ?? bill.change.increase;
    if (!increase || accepted) continue;      // once the plan carries itself, this is no longer news
    breachExplained = true;
    alerts.push({
      id: `increase:${bill.id}`,
      tone: breach ? 'bad' : 'warn',
      title: `Your ${bill.label.toLowerCase()} bill increased by ${$(increase)}.`,
      body: [breachSentence, goalSentence, 'Review the effect on your goal.'].filter(Boolean).join(' '),
      actions: [
        { label: 'See what changed', target: 'bill', billId: bill.id, primary: true },
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
      title: `Your ${bill.label.toLowerCase()} charge came in ${$(Math.abs(gap))} ${gap < 0 ? 'lower' : 'higher'} than usual.`,
      body: `${$(bill.lastPosted)} posted${bill.lastPostedDate ? ` on ${shortIso(bill.lastPostedDate)}` : ''}, against a usual ${$(usual)}. We have not confirmed why.`
        + ' Review the charge, choose a future estimate, and save a next step for the company.',
      actions: [{ label: 'Review charge', target: 'anomaly', billId: bill.id, primary: true }],
    });
  }

  // --- 3. The cushion is breached and no change above accounts for it. ---
  if (breach && !breachExplained) {
    alerts.push({
      id: 'cushion',
      tone: 'bad',
      title: `Projected balance falls to ${$(sim.low.balance)} on ${short(sim.low.date)}.`,
      body: `That is below your ${$(h.cushion)} cushion before your next paycheck.`
        + (!fits ? ` Your plan supports ${$(cap)} a month rather than the ${$(sc.contribution)} you have scheduled.` : '')
        + (goalSentence ? ` ${goalSentence}` : ''),
      actions: [{ label: 'Compare options', target: 'compare', primary: true }],
    });
  }

  // A goal can fall short even when the near-term checking forecast is comfortable.
  // Use the current dated goal, not the original sample's contribution count.
  if (!breach && !breachExplained && (goal.gap > 0 || !goal.fits)) {
    alerts.push({
      id: 'goal', tone: 'warn', title: `${h.goal.label} needs a plan adjustment.`,
      body: `${goalSentence} Review the monthly saving amount, costs, or deadline. Nothing changes until you choose.`,
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
      body: `${lastAction.label}. Nothing was transferred; complete a contribution on the Goals page when you are ready.`,
      actions: [{ label: 'Open Goals', target: 'page:goals' }],
    });
  }

  const rank = { bad: 0, warn: 1, good: 2 };
  return alerts.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
