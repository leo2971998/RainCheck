import { createHash } from 'node:crypto';
import { transactionRecords } from '../src/engine/records.js';
import { buildHousehold, detectPostedChanges } from '../src/engine/household.js';

const cents = value => {
  const n = Math.round(value * 100);
  if (!Number.isFinite(value) || !Number.isSafeInteger(n)) throw new Error('Invalid monetary value in source.');
  return n;
};
const text = value => Array.isArray(value) ? value.join(', ') : String(value || '');
const canonical = value => JSON.stringify(value, (_, v) => Array.isArray(v)
  ? [...v].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const dollars = n => `USD ${(n / 100).toFixed(2)}`;

/** A complete, versioned import, not the UI's recent-30-transaction list. */
export function prepareKnowledge(snap, { dataset, asOf }) {
  if (!['demo', 'backend'].includes(dataset)) throw new Error('Unknown dataset.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || new Date(asOf).toISOString().slice(0, 10) !== asOf)
    throw new Error('Invalid as-of date.');
  if (!snap.customerId || !snap.accounts?.length || snap.accounts.some(a => a.customer_id !== snap.customerId))
    throw new Error('Every account must belong to the selected customer.');
  const accounts = snap.accounts.map(a => ({ id: a._id, name: a.nickname || a.type, kind: a.type, balance_cents: cents(a.balance) }));
  const owned = new Set(accounts.map(a => a.id));
  if (!owned.has(snap.checkingId) || !owned.has(snap.savingsId)) throw new Error('Configured accounts are missing.');
  if (!snap.accountRecords || snap.accountRecords.length !== accounts.length
      || new Set(snap.accountRecords.map(a => a.accountId)).size !== accounts.length
      || snap.accountRecords.some(a => !owned.has(a.accountId))) throw new Error('Incomplete account snapshot.');
  const merchants = (snap.merchants || []).map(m => ({ id: m._id, name: m.name, category: text(m.category) }));
  const bills = snap.accountRecords.flatMap(a => (a.bills || []).map(b => ({ id: b._id, account_id: a.accountId,
    name: b.nickname || b.payee, payee: b.payee, amount_cents: cents(b.payment_amount), details: b })));
  const transactions = accounts.flatMap(a => transactionRecords(snap, asOf, a.id).map(t => ({
    id: t.id, account_id: a.id, source_id: t.sourceId, source_type: t.sourceType,
    merchant_id: t.merchantId, bill_id: t.billId, booked_on: t.date, amount_cents: cents(t.amount),
    description: t.description, kind: t.kind, category: text(t.category), details: t,
  })));
  const household = buildHousehold(snap, asOf);
  household.recurring = detectPostedChanges(household, snap);
  const documents = [];
  const add = (id, source_type, source_id, title, body, account_id = null, record_date = null) =>
    documents.push({ id, source_type, source_id, title, body, account_id, record_date });
  for (const a of accounts) add(`account:${a.id}`, 'account', a.id, a.name,
    `${a.kind} account. Reported balance ${dollars(a.balance_cents)} as of ${asOf}. Synthetic Nessie sandbox data.`, a.id, asOf);
  for (const m of merchants) add(`merchant:${m.id}`, 'merchant', m.id, m.name, `Merchant category: ${m.category}.`);
  for (const b of bills) add(`bill:${b.id}`, 'bill', b.id, b.name,
    `Payee: ${b.payee}. Bill amount: ${dollars(b.amount_cents)}. Status: ${b.details.status || 'not provided'}. `
    + `Billing day: ${b.details.recurring_date ?? 'not provided'}. Payment date: ${b.details.payment_date || 'not provided'}. `
    + 'A bill is a scheduled commitment, not an additional posted transaction.', b.account_id);
  for (const t of transactions) add(`transaction:${t.id}`, t.source_type, t.source_id, t.description,
    `${t.booked_on}: ${t.description}. Signed amount ${dollars(t.amount_cents)}. Kind: ${t.kind}. Category: ${t.category}. `
    + (t.kind === 'transfer' ? 'Transfer, not income or spending. Counterpart matching is inferred, not bank-confirmed.' : ''), t.account_id, t.booked_on);
  add('forecast:income', 'derived', 'income', 'Expected paychecks', 'Estimated from posted payroll history; not guaranteed deposits. '
    + household.income.map(i => `${i.date}: ${dollars(cents(i.amount))}; every ${i.cadenceDays} days.`).join(' '), snap.checkingId, asOf);
  add('forecast:goal', 'derived', 'goal', 'Starting savings goal',
    `Default demo goal: ${dollars(cents(household.goal.target))} by ${household.goal.targetDate}. `
    + 'This is the base household, not the user\'s accepted browser plan. Recalculate with RainCheck\'s engine before discussing feasibility.', snap.savingsId, asOf);
  // Keep source evidence, including pending/future activity, but do not ingest account numbers or merchant addresses.
  const source_snapshot = { customerId: snap.customerId, checkingId: snap.checkingId, savingsId: snap.savingsId,
    accounts: snap.accounts.map(({ account_number, ...a }) => a), merchants,
    accountRecords: snap.accountRecords };
  const content = { dataset, customer_id: snap.customerId, as_of: asOf, source: snap.source,
    accounts, merchants, bills, transactions, documents, household, source_snapshot };
  return { ...content, captured_at: snap.capturedAt || new Date().toISOString(),
    fingerprint: createHash('sha256').update(canonical(content)).digest('hex') };
}
