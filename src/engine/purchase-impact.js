import { withPurchase } from './purchases.js';
import { budgetImpact } from './budget.js';
import { householdFor, scenarioFor } from './plan.js';
import { simulate, projectIncome, scheduleUntil } from './forecast.js';
import { fundedGoals } from './goal-funding.js';

const day = value => Date.parse(value + 'T12:00:00Z') / 864e5;
const afterDays = (date, count) => new Date((day(date) + count) * 864e5).toISOString().slice(0, 10);
const money = n => Math.round(n * 100) / 100;

/** Check the money needed before spending, not hypothetical savings made after a cash gap. */
function purchaseFunding(base, plan, patch, next, effective) {
  const h = householdFor(next, plan);
  const through = date => [h.goal.targetDate || date, afterDays(date, base.windowDays - 1)].sort().at(-1);
  const checkedThrough = through(effective);
  const run = (b, end = checkedThrough, skipSaving = false) => {
    const household = { ...householdFor(b, plan), fundedGoals: skipSaving ? [] : fundedGoals(b, plan) };
    const scenario = { ...scenarioFor(household, plan), income: projectIncome(household, end) };
    return simulate(household, scenario, { days: day(end) - day(base.today) + 1 });
  };
  const withoutPurchase = patch.id ? withPurchase(base, null, patch.id, true) : base;
  const baselineFits = run(withoutPurchase).low.balance >= h.cushion;
  const current = run(next), low = current.low.balance, fits = low >= h.cushion;
  let maxAmount = null, laterDate = null;
  if (!patch.remove && baselineFits) {
    let lo = 0, hi = Math.round(patch.draft.amount * 100);
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const trial = withPurchase(base, { ...patch.draft, amount: mid / 100 }, patch.id);
      if (run(trial).low.balance >= h.cushion) lo = mid; else hi = mid - 1;
    }
    maxAmount = lo / 100;
    if (!fits) {
      const paydays = projectIncome(h, afterDays(base.today, 730)).map(p => p.date)
        .filter(d => d > effective && day(d) - day(base.today) <= 730);
      laterDate = paydays.find(date => run(withPurchase(base, { ...patch.draft, date }, patch.id), through(date)).low.balance >= h.cushion) || null;
    }
  }
  const options = [];
  const option = (kind, amount, date) => {
    const end = through(date), result = run(withPurchase(base, { ...patch.draft, amount, date }, patch.id), end);
    return { kind, amount, date, low: result.low.balance, lowDate: result.low.key, checkedThrough: end };
  };
  if (laterDate) options.push(option('later', patch.draft.amount, laterDate));
  if (maxAmount > 0 && maxAmount < patch.draft?.amount) options.push(option('smaller', maxAmount, patch.draft.date));
  return { fits, baselineFits, checkedThrough, low, lowDate: current.low.key, options,
    neededToAvoidNegative: money(Math.max(0, -low)), neededToKeepCushion: money(Math.max(0, h.cushion - low)),
    maxAmount, laterDate, withoutSavingLow: run(next, checkedThrough, true).low.balance };
}

export function purchaseImpact(base, plan, patch) {
  if (!patch || Object.keys(patch).some(k => !['draft','id','remove'].includes(k)) || (patch.remove && !patch.id))
    throw new Error('Check the purchase preview.');
  const next = withPurchase(base, patch.draft, patch.id, patch.remove);
  const date = patch.remove ? base.plannedPurchases.find(p => p.id === patch.id).date : patch.draft.date;
  const effective = date < base.today ? base.today : date;
  const monday = new Date(effective + 'T12:00:00Z'); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6);
  const startsOn = [base.today, monday.toISOString().slice(0,10)].sort().at(-1), endsOn = sunday.toISOString().slice(0,10);
  const days = Math.round((sunday - new Date(base.today + 'T12:00:00Z')) / 864e5) + 1;
  const weekLow = b => {
    const h = { ...householdFor(b, plan), fundedGoals: fundedGoals(b, plan) }, sc = scenarioFor(h, plan);
    return Math.min(...simulate(h, { ...sc, income: projectIncome(h, endsOn), contributionDates: scheduleUntil(h, endsOn) }, { days }).days.filter(d => d.key >= startsOn).map(d => d.balance));
  };
  return { ...budgetImpact(base, plan, {}), after: budgetImpact(next, plan, {}).after,
    week: { startsOn, endsOn, beforeLow: weekLow(base), afterLow: weekLow(next) },
    funding: purchaseFunding(base, plan, patch, next, effective) };
}

export function purchaseEvidenceDocuments(impact) {
  const f = impact.funding;
  if (!f) return [];
  const evidence = [{ title: 'Purchase affordability and tested alternatives', asOf: impact.asOf,
    text: `Checked through ${f.checkedThrough}: low $${f.low} on ${f.lowDate}; needs $${f.neededToAvoidNegative} to avoid negative checking or $${f.neededToKeepCushion} to keep the cushion. Fits: ${f.fits}. Without this purchase fits: ${f.baselineFits}. With goal contributions paused, low $${f.withoutSavingLow}. Tested smaller purchase: ${f.maxAmount == null ? 'none fits' : '$' + f.maxAmount}; tested later date: ${f.laterDate || 'none found'}. Goal totals assume contributions; never call an unfundable goal on track. Money saved after the cash-gap date cannot fix it. These are previews, not changes.` }];
  return evidence.concat(f.options.length ? [{ title: 'Purchase plan choices', asOf: impact.asOf,
      text: `All choices keep existing bills and goal contributions unchanged. ${f.options.map(o => `${o.kind}: purchase $${o.amount} on ${o.date}; checking stays at least $${o.low}, checked through ${o.checkedThrough}.`).join(' ')} Prefer a later date to preserve the intended purchase amount; a smaller cost means changing what is bought. Explain these trade-offs, not just whether the original fails. No changes are saved.` }] : []);
}
