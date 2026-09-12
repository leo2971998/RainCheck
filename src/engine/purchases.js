// One-time estimates, not payment instructions. Bank records are never changed here.
const cents = n => Math.round(n * 100);
const money = n => cents(n) / 100;
const dayNumber = s => Date.parse(s + 'T12:00:00Z') / 86400000;
const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && Number.isFinite(dayNumber(s)) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
const name = (s, optional = false) => {
  if (optional && !s) return '';
  if (typeof s !== 'string' || !s.trim() || s.length > 100 || /[<>\x00-\x1f]/.test(s)) throw new Error('Enter a short, plain-text name.');
  return s.trim();
};

export function readPurchase(input, h) {
  if (!input || typeof input !== 'object') throw new Error('Check the purchase details.');
  const amount = Number(input.amount);
  if (!['number','string'].includes(typeof input.amount) || !/^\d+(\.\d{1,2})?$/.test(String(input.amount))
    || !Number.isFinite(amount) || amount <= 0 || amount > 100000 || Math.abs(amount * 100 - cents(amount)) > 0.00001)
    throw new Error('Enter an amount between $0.01 and $100,000, with up to two decimal places.');
  if (!validDate(input.date) || dayNumber(input.date) < dayNumber(h.today) - 30 || dayNumber(input.date) > dayNumber(h.today) + 730)
    throw new Error('Choose a real date within the last 30 days or next two years.');
  if (!h.checkingId || input.accountId !== h.checkingId) throw new Error('Choose this household’s checking account.');
  const allowanceId = input.allowanceId || null;
  if (allowanceId && !h.allowances.some(a => a.id === allowanceId)) throw new Error('Choose an existing spending allowance.');
  return { label: name(input.label), merchant: name(input.merchant, true), amount: money(amount), date: input.date,
    accountId: h.checkingId, allowanceId };
}

export const purchaseState = (p, today) => p.status === 'planned' && p.date < today ? 'overdue' : p.status;

/** Move covered allowance spending to the known purchase date; only the excess is new spending.
 * Use the full remaining calendar month even for a short forecast, so all horizons agree. */
export function purchaseSchedule(h, sc = {}) {
  const allocations = {}, dates = {}, reductions = {}, remaining = {};
  const active = (h.plannedPurchases || []).filter(p => p.status === 'planned')
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const p of active) {
    const effectiveDate = p.date < h.today ? h.today : p.date;
    const month = effectiveDate.slice(0, 7), bucket = month + ':' + p.allowanceId;
    const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0, 12)).toISOString().slice(0, 10);
    const start = h.today > month + '-01' ? h.today : month + '-01';
    const days = dayNumber(end) - dayNumber(start) + 1;
    const allowance = h.allowances.find(a => a.id === p.allowanceId);
    if (!(bucket in remaining)) remaining[bucket] = allowance ? Math.max(0, allowance.monthly - (sc.cuts?.[allowance.id] || 0)) / 30 * days : 0;
    const covered = money(Math.min(p.amount, remaining[bucket]));
    remaining[bucket] = Math.max(0, remaining[bucket] - covered);
    reductions[month] = (reductions[month] || 0) + covered / days;
    allocations[p.id] = { covered, extra: money(p.amount - covered), effectiveDate };
    (dates[effectiveDate] ||= []).push(p);
  }
  return { dates, reductions, allocations };
}

const normalized = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function matchCandidates(p, transactions, all, today) {
  if (p.status !== 'planned') return [];
  const used = new Set(all.filter(x => x.status === 'completed').map(x => x.transactionId));
  return transactions.filter(t => {
    const expected = normalized(p.merchant || p.label), actual = normalized(t.description);
    return !used.has(t.id) && t.accountId === p.accountId && t.status === 'completed'
      && t.sourceType === 'purchase' && t.kind === 'purchase' && t.amount < 0
      && validDate(t.date) && t.date <= today && Math.abs(dayNumber(t.date) - dayNumber(p.date)) <= 7
      && Math.abs(cents(-t.amount) - cents(p.amount)) <= Math.max(100, cents(p.amount * .1))
      && expected.length >= 3 && actual.length >= 3 && (actual.includes(expected) || expected.includes(actual));
  });
}

export function confirmPurchaseMatch(p, transaction, all, today, confirmed) {
  if (confirmed !== true || !transaction || !matchCandidates(p, [transaction], all, today).length)
    throw new Error('This charge cannot be matched. Refresh and check the merchant, amount and date.');
  return { ...p, status: 'completed', transactionId: transaction.id, actualAmount: money(-transaction.amount), actualDate: transaction.date };
}

export function withPurchase(base, draft, id = null, remove = false) {
  const existing = id && (base.plannedPurchases || []).find(p => p.id === id);
  if (id && (!existing || existing.status !== 'planned')) throw new Error('This purchase changed. Refresh your plans.');
  const records = (base.plannedPurchases || []).filter(p => p.id !== id);
  if (!remove) records.push({ ...readPurchase(draft, base), id: id || 'preview', status: 'planned' });
  return { ...base, plannedPurchases: records };
}
