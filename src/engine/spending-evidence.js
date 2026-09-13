import { spendingInsights } from './spending-insights.js';

const money = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
const label = s => String(s).replace(/[\u0000-\u001f<>]/g, '').slice(0, 60);

/** Bounded, category-level facts for the existing ZeroClaw service. No raw receipts or merchant names. */
export function spendingEvidenceDocuments(h, sc, after, afterSc, protectedIds = {}) {
  const data = spendingInsights(h, sc, protectedIds);
  const categories = [...data.categories].sort((a, b) => b.over - a.over || (b.spent || 0) - (a.spent || 0));
  const observed = categories.slice(0, 8).map(c => `${label(c.label)}: recorded ${c.spent == null ? 'unavailable' : money(c.spent)}, monthly budget ${money(c.budget)}, usual ${money(c.usual)}; ${c.completeMonths} complete months of history. ${c.oneOff ? money(c.oneOff) + ' is one-time spending.' : ''}`);
  const changes = data.categories.map(c => {
    const a = after.allowances.find(a => a.id === c.id);
    const target = Math.max(0, (a?.monthly || 0) - (afterSc.cuts?.[c.id] || 0));
    return target === c.budget ? null : `${label(c.label)} budget: ${money(c.budget)} to ${money(target)} per month.`;
  }).filter(Boolean);
  const trials = data.categories.filter(c => c.suggestedCut > 0).sort((a, b) => b.suggestedCut - a.suggestedCut).slice(0, 3)
    .map(c => `${label(c.label)}: an optional ${money(c.suggestedCut)} monthly reduction to discuss; typical recorded purchase ${money(c.averagePurchase)}. This is a bounded trial, not proof the category is wasteful.`);
  const protectedNames = data.categories.filter(c => c.protected).map(c => label(c.label));
  return [
    { title: 'Recorded category spending', asOf: h.today, text: `Period ${data.month}, recorded through ${h.today}; ${data.daysLeft} days remaining. Flexible spending ${data.spent == null ? 'unavailable' : money(data.spent)}. Showing ${observed.length} of ${categories.length} categories. ${observed.join(' ')}`.slice(0, 2300) },
    { title: 'Spending proposal and limits', asOf: h.today, text: `${changes.length ? changes.slice(0, 10).join(' ') : 'No spending target changes proposed yet.'} Monthly goal contributions: ${money(sc.contribution)} to ${money(afterSc.contribution)}. These are potential changes, not money already saved. Actual saved balances do not change. Keep unchanged: ${protectedNames.join(', ') || 'no categories selected'}. Fixed bills are outside this exercise. Account for replacement costs; never promise a goal is affordable when the calculator says otherwise.`.slice(0, 2300) },
    { title: 'Optional savings trials', asOf: h.today, text: `${trials.join(' ') || 'Insufficient unprotected category evidence for automatic trials; ask the user what can realistically change.'} Explain choices, do not claim an optimal plan or assume future behavior. Three months of similar totals do not prove spending will remain flat. The user chooses and confirms any change.`.slice(0, 2000) },
  ];
}
