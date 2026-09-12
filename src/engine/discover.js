// src/engine/discover.js
//
// Find commitments the bank has not recorded as bills.
//
// A subscription charged to a card often never appears in a bill list, so the forecast misses it
// entirely. This looks for the shape of one in the purchase history — same merchant, steady
// amount, steady interval — and PROPOSES it. It never adds anything on its own, because a
// repeated purchase is not a subscription, and treating one as a commitment would put money in
// the forecast that the user never committed to.

const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/**
 * @returns candidates the user can confirm, each with the evidence that suggested it.
 */
export function discoverCommitments(snap, household, { minCharges = 3, tolerance = 0.06, monthsCovered = 3 } = {}) {
  const merchant = Object.fromEntries((snap.merchants || []).map(m => [m._id, m]));
  const knownPayees = new Set(household.recurring.map(r => r.payee?.toLowerCase()).filter(Boolean));

  const byMerchant = {};
  for (const p of snap.purchases || []) {
    const name = merchant[p.merchant_id]?.name;
    if (!name || knownPayees.has(name.toLowerCase())) continue;   // already a bill; not a discovery
    (byMerchant[name] ||= []).push(p);
  }

  const found = [];
  for (const [name, charges] of Object.entries(byMerchant)) {
    if (charges.length < minCharges) continue;
    const sorted = charges.sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));

    // A subscription charges the SAME amount. Groceries do not.
    const amounts = sorted.map(c => c.amount);
    const typical = median(amounts);
    if (!typical) continue;
    const steadyAmount = amounts.every(a => Math.abs(a - typical) / typical <= tolerance);
    if (!steadyAmount) continue;

    // …on a steady interval. Four rides in a month are frequent, not scheduled.
    const gaps = sorted.slice(1).map((c, i) => daysBetween(sorted[i].purchase_date, c.purchase_date));
    const cycle = median(gaps);
    if (!cycle || cycle < 20) continue;                           // weekly repeats are not commitments
    const steadyInterval = gaps.every(g => Math.abs(g - cycle) <= 6);
    if (!steadyInterval) continue;

    const last = sorted[sorted.length - 1];
    // Which spending category these charges are currently counted in, and how much of it they are.
    // Adopting the commitment has to take that share back out, or the money is counted twice.
    const category = merchant[sorted[0].merchant_id]?.category || 'Other';
    const monthlyShare = Math.round(sorted.reduce((a, c) => a + c.amount, 0) / monthsCovered);
    found.push({
      category,
      categoryId: slug(category),
      monthlyShare,
      id: slug(name),
      label: name,
      payee: name,
      amount: Math.round(typical),
      day: Number(last.purchase_date.slice(8, 10)),
      everyMonths: cycle >= 300 ? 12 : cycle >= 150 ? 6 : cycle >= 75 ? 3 : 1,
      freq: cycle >= 300 ? 'Annual' : cycle >= 150 ? 'Twice a year' : cycle >= 75 ? 'Quarterly' : 'Monthly',
      anchor: last.purchase_date,
      cancellable: true,
      discovered: true,
      evidence: sorted.map(c => ({ date: c.purchase_date, amount: c.amount })),
      why: `${sorted.length} charges of about $${Math.round(typical)}, roughly every ${cycle} days. Currently counted inside your ${category.toLowerCase()} spending.`,
    });
  }
  return found.sort((a, b) => b.amount - a.amount);
}
