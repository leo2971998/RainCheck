import { spendingInsights } from './spending-insights.js';

const money = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
const label = s => String(s).replace(/[\u0000-\u001f<>]/g, '').slice(0, 60);

// The deployed review service accepts 700 characters per excerpt. Keep whole facts (especially
// amounts), not arbitrary string slices; larger households retain totals and an omission notice.
function excerpt(prefix, rows, suffix = '') {
  const join = parts => parts.filter(Boolean).join(' ');
  const full = join([prefix, ...rows, suffix]);
  if (full.length <= 700) return full;
  const kept = [];
  const reserve = `${rows.length} entries omitted.`;
  for (const row of rows)
    if (join([prefix, ...kept, row, suffix, reserve]).length <= 700) kept.push(row);
  return join([prefix, ...kept, suffix, `${rows.length - kept.length} entries omitted.`]);
}

/** Bounded, category-level facts for the existing ZeroClaw service. No raw receipts or merchant names. */
export function spendingEvidenceDocuments(h, sc, after, afterSc, protectedIds = {}, goals = [], recovery = null) {
  const data = spendingInsights(h, sc, protectedIds);
  const categories = [...data.categories].sort((a, b) => b.over - a.over || (b.spent || 0) - (a.spent || 0));
  const observed = categories.map(c => `${label(c.label)}: recorded ${c.spent == null ? 'unavailable' : money(c.spent)}, budget ${money(c.budget)}; ${c.completeMonths} complete months.${c.over > 0 ? ' Already ' + money(c.over) + ' over; review purchases.' : ''}${c.oneOff ? ' One-time spending ' + money(c.oneOff) + '.' : ''}`);
  const changes = data.categories.map(c => {
    const a = after.allowances.find(a => a.id === c.id);
    const target = Math.max(0, (a?.monthly || 0) - (afterSc.cuts?.[c.id] || 0));
    return target === c.budget ? null : `${label(c.label)} budget: ${money(c.budget)} to ${money(target)} per month.`;
  }).filter(Boolean);
  const trials = data.categories.filter(c => c.suggestedCut > 0 && c.over === 0).sort((a, b) => b.suggestedCut - a.suggestedCut).slice(0, 3)
    .map(c => `${label(c.label)}: optional cut ${money(c.suggestedCut)}/month; typical purchase ${money(c.averagePurchase)}.`);
  const protectedRows = data.categories.filter(c => c.protected).map(c => `Keep ${label(c.label)} unchanged.`);
  const goalFacts = goals.map(g => `${label(g.label)}: needs ${g.needed == null ? 'unknown' : money(g.needed)}/month; planned ${money(g.planned)}/month; extra needed ${g.extraNeeded == null ? 'unknown' : money(g.extraNeeded)}/month; unassigned ${g.remainingNeeded == null ? 'unknown' : money(g.remainingNeeded)}/month by ${g.targetDate}.`);
  const goalTotal = key => goals.some(g => g[key] == null) ? 'unknown' : money(goals.reduce((sum, g) => sum + g[key], 0));
  return [
    { title: 'Recorded category spending', asOf: h.today, text: excerpt(`Period ${data.month}; ${data.daysLeft} days remaining. Flexible spending ${data.spent == null ? 'unavailable' : money(data.spent)} across ${categories.length} categories.`, observed,
      'Recorded overruns are not refundable amounts or proof costs will repeat.') },
    { title: 'Spending proposal and limits', asOf: h.today, text: excerpt(`Monthly goal contributions: ${money(sc.contribution)} to ${money(afterSc.contribution)}. These are potential changes, not money already saved. Fixed bills and protected categories stay unchanged.`,
      [...protectedRows, ...(changes.length ? changes : ['No spending target changes proposed yet.'])], 'Account for replacement costs. The user must confirm changes.') },
    { title: 'Goal funding and optional cuts', asOf: h.today, text: excerpt(`${goals.length} goals; extra needed ${goalTotal('extraNeeded')}/month; unassigned ${goalTotal('remainingNeeded')}/month.`
      + (recovery ? ` Separate recovery objective: ${money(recovery.amount)} by ${recovery.deadline}; required ${money(recovery.requiredMonthly)}/month. Proposed cuts recover ${money(recovery.projected)}; still short ${money(recovery.remaining)}; additional cuts needed ${money(recovery.extraMonthlyNeeded)}/month. ${recovery.remaining > 0 ? 'Recovery NOT solved even if goals fit.' : 'Recovery fits only if cuts are followed.'}` : ''),
      [...goalFacts, ...trials], 'Cuts are optional trials, not proof of waste. Check contributionFits before calling goals affordable.') },
  ];
}
