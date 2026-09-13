import { householdVersion, readReviewPlan } from './_review.js';
import { budgetImpact, readSubscription, subscriptionPatch } from '../src/engine/budget.js';
import { householdFor, scenarioFor } from '../src/engine/plan.js';
import { amountFor, nextChargeDate, round2, simulate } from '../src/engine/forecast.js';
import { forecastEvidenceDocuments } from '../src/engine/forecast-explanation.js';
import { weeklyBudget } from '../src/engine/weekly-budget.js';
import { spendingInsights } from '../src/engine/spending-insights.js';
import { optimizationDraft, savingsPreview } from '../src/engine/savings-plan.js';

const object = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => keys.includes(k));
export function calculateChat(base, body) {
  if (!object(body, ['consent', 'baseVersion', 'plan', 'tool', 'args', 'dataset']) || body.consent !== true
    || (body.dataset !== undefined && !['demo', 'history'].includes(body.dataset))) throw new Error('Invalid request');
  if (body.baseVersion !== householdVersion(base)) throw Object.assign(new Error('The bank data changed. Refresh RainCheck before asking again.'), { status: 409 });
  const plan = readReviewPlan(body.plan, base);
  const h = householdFor(base, plan), sc = scenarioFor(h, plan), args = body.args;
  if (!object(args, ['question', 'billId', 'amount', 'change', 'startsOn']) || (args.question !== undefined && (typeof args.question !== 'string' || args.question.length > 500))) throw new Error('Invalid details');
  const bills = h.recurring.filter(r => !sc.cancelled?.[r.id]).map(r => ({ id: r.id, label: r.label,
    estimate: amountFor(r, nextChargeDate(r, h.today), sc), nextDate: nextChargeDate(r, h.today) }));
  let patch = {}, preview = null;
  if (body.tool === 'get_current_plan') {
    if (!object(args, ['question'])) throw new Error('Unexpected details');
  } else if (body.tool === 'preview_bill') {
    if (!object(args, ['question', 'billId', 'amount', 'change'])) throw new Error('Unexpected details');
    const bill = bills.find(b => b.id === args.billId);
    if (!bill || !['by', 'to'].includes(args.change) || typeof args.amount !== 'number' || !Number.isFinite(args.amount) || Math.abs(args.amount) > 1000000 || round2(args.amount) !== args.amount) throw new Error('Invalid bill');
    const amount = args.change === 'by' ? round2(bill.estimate + args.amount) : args.amount;
    if (amount < 0 || amount > 1000000) throw new Error('Invalid amount');
    patch = { billChanges: { [bill.id]: { to: amount, effective: bill.nextDate, why: 'Chat preview only' } }, whatIf: { [bill.id]: amount } };
    preview = { label: bill.label, amount, oldAmount: bill.estimate, startsOn: bill.nextDate, applied: false };
  } else if (body.tool === 'preview_monthly_cost') {
    if (!object(args, ['question', 'amount', 'startsOn']) || typeof args.amount !== 'number') throw new Error('Invalid monthly cost');
    const item = readSubscription({ label: 'Extra monthly cost', amount: args.amount, startsOn: args.startsOn ?? h.today }, h.today);
    let id = 'sub-chat-preview';
    while (plan.subscriptions?.[id]) id += '-new';
    patch = subscriptionPatch(id, item);
    preview = { label: item.label, amount: item.amount, startsOn: item.startsOn, applied: false };
  } else throw new Error('This chat cannot perform that action');
  // A labeled calculator example, not an AI-reviewed or applied optimization. Keep groceries
  // unchanged here; the Spending & Savings editor uses the user's actual checkbox choices.
  let recoveryExample = null;
  const insights = spendingInsights(h, sc);
  if (insights.available && insights.categories.some(c => c.over > 0)) {
    const draft = optimizationDraft(base, plan, { groceries: true });
    const example = savingsPreview(base, plan, draft, { groceries: true });
    recoveryExample = { ...example.guidance.recovery, monthlyReduction: example.freed, extraSavings: example.extraSavings };
  }
  return { impact: budgetImpact(base, plan, patch), bills, preview, ...(base.spendingModel ? { history: base.spendingModel } : {}),
    recoveryExample,
    weekly: weeklyBudget(h, sc),
    categoryOverruns: insights.categories.filter(c => c.over > 0)
      .map(({ label, spent, budget, over }) => ({ label, spent, budget, over })),
    forecastEvidence: forecastEvidenceDocuments(h, simulate(h, sc)),
    assumptions: ['Nessie sandbox data, not a real bank account.', 'Forecasts are estimates based on the current plan.', 'Any preview is separate from your saved plan. No payment or budget changes have been made.'] };
}
