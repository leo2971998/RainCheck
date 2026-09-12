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
  return {
    to: Number(renew[1].replace(/,/g, '')),
    effective: `${year}-${String(month).padStart(2, '0')}-${String(renew[3]).padStart(2, '0')}`,
    why: credit ? 'Promotional credit ended' : 'Not stated in the notice',
    evidence: [renew[0], credit?.[0]].filter(Boolean),   // the exact phrases to highlight
    source: 'notice',
  };
}
