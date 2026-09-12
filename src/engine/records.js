// Shared, UI-independent reading rules for the API and forecast preparation.
const dateOf = r => r.purchase_date || r.transaction_date;
export const depositKind = r => /\btransfer\b/i.test(r.description || '') ? 'transfer'
  : /\brefund|reimbursement\b/i.test(r.description || '') ? 'refund'
  : /\bpayroll|paycheck|salary|wages|pension|social security\b/i.test(r.description || '') ? 'income' : 'credit';
export const withdrawalKind = r => /\btransfer\b/i.test(r.description || '') ? 'transfer' : 'withdrawal';

/** Scope by account, booking status, and as-of date before using records as evidence. */
export function postedSnapshot(snap, today, accountId = snap.checkingId) {
  const account = snap.accountRecords?.find(a => a.accountId === accountId) || snap;
  const posted = rows => (rows || []).filter(r => {
    const owner = r.account_id || r.payer_id;
    return (!owner || !accountId || owner === accountId)
      && (!r.status || r.status === 'completed')
      && /^\d{4}-\d{2}-\d{2}$/.test(dateOf(r)) && dateOf(r) <= today
      && Number.isFinite(r.amount) && r.amount > 0;
  });
  return { ...snap, bills: (account.bills || []).filter(b => !b.status || b.status === 'recurring' || b.status === 'pending'),
    deposits: posted(account.deposits), purchases: posted(account.purchases), withdrawals: posted(account.withdrawals) };
}

/** Stable native IDs remain available for later CRUD; display dates never replace ISO dates. */
export function transactionRecords(snap, today, accountId = snap.checkingId) {
  const s = postedSnapshot(snap, today, accountId);
  const merchants = new Map((s.merchants || []).map(m => [m._id, m]));
  const rows = [];
  for (const [collection, type, direction] of [['deposits', 'deposit', 1], ['purchases', 'purchase', -1], ['withdrawals', 'withdrawal', -1]]) {
    for (const r of s[collection]) {
      const merchant = merchants.get(r.merchant_id);
      const bill = s.bills.find(b => b.payee?.toLowerCase() === merchant?.name?.toLowerCase());
      const kind = type === 'deposit' ? depositKind(r) : type === 'withdrawal' ? withdrawalKind(r) : bill ? 'bill' : 'purchase';
      rows.push({ id: `${type}:${r._id}`, sourceId: r._id, sourceType: type, accountId,
        merchantId: r.merchant_id || null, billId: bill?._id || null, date: dateOf(r),
        description: merchant?.name || r.description || 'Bank activity', amount: direction * r.amount,
        kind, category: kind === 'income' ? 'Income' : kind === 'transfer' ? 'Transfer'
          : kind === 'refund' ? 'Refund' : kind === 'credit' ? 'Other credit'
            : bill?.nickname || merchant?.category || 'Other', status: r.status || 'completed' });
    }
  }
  for (const row of rows.filter(r => r.kind === 'transfer')) {
    const opposite = row.sourceType === 'deposit' ? 'withdrawals' : 'deposits';
    const type = row.sourceType === 'deposit' ? 'withdrawal' : 'deposit';
    const candidates = (snap.accountRecords || []).filter(a => a.accountId !== accountId).flatMap(a =>
      postedSnapshot(snap, today, a.accountId)[opposite]
        .filter(r => /\btransfer\b/i.test(r.description || '') && dateOf(r) === row.date && r.amount === Math.abs(row.amount))
        .map(r => ({ id: `${type}:${r._id}`, accountId: a.accountId })));
    const sameSide = rows.filter(r => r.kind === 'transfer' && r.date === row.date && r.amount === row.amount);
    const matched = candidates.length === 1 && sameSide.length === 1;
    row.counterpartId = matched ? candidates[0].id : null;
    row.counterpartAccountId = matched ? candidates[0].accountId : null;
    row.relationshipStatus = matched ? 'matched' : candidates.length ? 'ambiguous' : 'unmatched';
    row.relationshipBasis = 'Transfer descriptions, equal amount, same date, different owned accounts; not bank-confirmed linkage.';
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
