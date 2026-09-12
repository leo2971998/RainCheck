export function detectPostedChanges(household, purchases, merchants) {
  const byName = Object.fromEntries(merchants.map(m => [m._id, m.name]));
  return household.recurring.map(r => {
    const posted = purchases.filter(p => byName[p.merchant_id]?.toLowerCase().includes(r.payee?.toLowerCase())).sort((a, b) => b.purchase_date.localeCompare(a.purchase_date))[0];
    if (!posted || Math.abs(posted.amount - r.amount) / r.amount <= 0.10) return r;
    return { ...r, lastPosted: posted.amount, unexplained: true };
  });
}

// Finds "renew at $90.00 starting with your October 1 bill" and "credit of $25.00 ended".
export function parseNotice(text, year = 2026) {
  const renew = /renew at \$([\d,.]+) starting with your ([A-Z][a-z]+) (\d{1,2}) bill/.exec(text);
  const credit = /promotional credit of \$([\d,.]+) ended/.exec(text);
  if (!renew) return null;
  const month = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(renew[2]) + 1;
  // Contact details, taken from the notice itself rather than guessed. If the notice does not
  // name a support address, the app says so instead of sending the user somewhere invented.
  const support = /\b((?:support|help|billing)\.[a-z0-9.-]+\.[a-z]{2,})/i.exec(text)?.[1] || null;
  const account = /account ending (\w{3,4})/i.exec(text)?.[1] || null;
  const sender = (/From:\s*([^<\n]+)/.exec(text)?.[1] || '').trim() || null;

  return {
    to: Number(renew[1].replace(/,/g, '')),
    effective: `${year}-${String(month).padStart(2, '0')}-${String(renew[3]).padStart(2, '0')}`,
    why: credit ? 'Promotional credit ended' : 'Not stated in the notice',
    credit: credit ? Number(credit[1].replace(/,/g, '')) : null,
    evidence: [renew[0], credit?.[0]].filter(Boolean),   // the exact phrases to highlight
    support, account, sender,
    source: 'notice',
  };
}

/**
 * Drafts a question the user can actually send. Every fact in it comes from the notice or the
 * user's own records, so nothing here is invented on their behalf.
 */
export function questionFor(bill, change) {
  const lines = [
    `Hello,`,
    ``,
    `My ${bill.label.toLowerCase()} is going from $${bill.amount} to $${change.to} a month, starting with my ${new Date(change.effective + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} bill.`,
    change.credit ? `Your notice says a $${change.credit} promotional credit ended.` : `Your notice does not say why.`,
    ``,
    `Could you tell me:`,
    `1. Is there a current promotion or plan I qualify for at my usage?`,
    `2. Is the $${change.to} rate fixed, or does it change again later?`,
    change.account ? `\nMy account ends ${change.account}.` : '',
    ``,
    `Thank you.`,
  ];
  return lines.filter(l => l !== undefined).join('\n');
}
