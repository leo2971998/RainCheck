// Per-session guidance, so local testing never edits the shared ElevenLabs agent.
export const CHAT_GROUNDING = 'RainCheck response rules: Never infer spending headroom from supported savings or the difference between a planned contribution and a capacity bound. Only the specific tested scenario is known. For a combined scenario, say it has not been calculated and ask which ONE change to preview; do not reassure the user it fits and do not substitute a bill change for a subscription. Do not invent recovery amounts or assume how many full months remain. Recovery dates and cuts are calculated in Spending & Savings > Optimize budgets. A positive checking forecast does not resolve already-recorded overspending. Keep the reply short and lead with any unresolved issue. Navigation: goals and contribution editing are inside Spending & Savings; there is NO separate Goals page. Editing a bill estimate in Recurring does not change what the company charges. Real transfers must be made through the bank, not a RainCheck transfer screen.';

export function compoundPreviewRequest(question) {
  return /\b(on top of|combined|combine|both changes|together with|as well as|plus (?:the|that|a|another))\b/i.test(question);
}
export const COMPOUND_REPLY = 'That combined plan has not been calculated. Chat can preview one change at a time against your saved plan. Would you like to check the bill change or the new subscription on its own?';
export function actionRequest(question) {
  return /^(?:(?:okay|ok|please)[,!\s]+)*(?:apply|save|transfer|send money|move money|cancel)\b/i.test(question.trim());
}
export const ACTION_REPLY = 'Chat cannot save changes, cancel a service or transfer money. Review and confirm budget changes in Spending & Savings or Recurring. A bill estimate only changes your forecast—not what the company charges. Use your bank for a real transfer.';

/** Precalculate only unambiguous supported requests. The agent must clarify everything else. */
export function questionPreview(question, bills = []) {
  if (compoundPreviewRequest(question)) return null;
  const q = question.replace(/\bnot (?:by|to)\s*\$[\d,.]+/gi, '');
  const amounts = [...q.matchAll(/\$([\d,]+(?:\.\d{1,2})?)(?![\d.])/g)];
  // A dated request needs clarification/agent interpretation, not an invented start date.
  if (amounts.length !== 1 || /\b(?:on|starting|from|in)\s+(?:\d|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|next|tomorrow)/i.test(q)) return null;
  const amount = Number(amounts[0][1].replaceAll(',', ''));
  if (!Number.isFinite(amount) || amount > 1000000) return null;
  if (/\b(?:new|add|preview)\b/i.test(q) && /\bmonthly\b/i.test(q) && /\b(?:subscription|cost|expense)\b/i.test(q))
    return amount > 0 ? { tool: 'preview_monthly_cost', args: { amount } } : null;
  const named = bills.filter(b => q.toLowerCase().includes(b.label.toLowerCase()));
  if (named.length !== 1 || !/\b(?:change|increase\w*|decrease\w*|reduce\w*|lower)\b/i.test(q)) return null;
  const to = /\bto\s*\$/i.test(q), by = /\bby\s*\$/i.test(q) || /\b(?:increase\w*|decrease\w*|reduce\w*|lower)\b/i.test(q);
  if (!to && !by) return null;
  return { tool: 'preview_bill', args: { billId: named[0].id, amount: !to && /\b(?:decrease\w*|reduce\w*|lower)\b/i.test(q) ? -amount : amount, change: to ? 'to' : 'by' } };
}
