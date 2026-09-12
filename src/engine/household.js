// src/engine/household.js
export function buildHousehold(snap, today) {
  const checking = snap.accounts.find(a => a.type === 'Checking');
  const savings = snap.accounts.find(a => a.type === 'Savings');

  // 1. Income: deposits whose description repeats. Transfers never appear here because
  //    Nessie keeps them in /transfers, and we only read /deposits.
  const byDesc = groupBy(snap.deposits, d => d.description);
  const pay = Object.values(byDesc).find(list => list.length >= 3)?.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date)) || [];
  const gapDays = pay.length >= 2 ? daysBetween(pay.at(-2).transaction_date, pay.at(-1).transaction_date) : 14;
  const income = [];
  for (let d = addIso(pay.at(-1)?.transaction_date || today, gapDays), n = 0; n < 3; d = addIso(d, gapDays)) {
    if (d < today) continue;
    income.push({ id: 'p' + income.length, label: 'Paycheck', date: d, amount: pay.at(-1)?.amount || 0, status: income.length === 0 ? 'confirmed' : 'estimated' });
    n++;
  }

  // 2. Recurring: Nessie bills are the source of truth. day = recurring_date.
  const recurring = snap.bills.map(b => ({ id: slug(b.nickname), label: b.nickname, payee: b.payee, amount: b.payment_amount, day: b.recurring_date }));

  // 3. Allowances: purchases over the last 90 days, grouped by merchant category, divided by 3.
  //    This is where "repeat purchases are not a subscription" lives: purchases feed allowances, never recurring.
  const merchant = Object.fromEntries(snap.merchants.map(m => [m._id, m]));
  const recent = snap.purchases.filter(p => daysBetween(p.purchase_date, today) <= 90);
  const byCat = groupBy(recent, p => merchant[p.merchant_id]?.category || 'Other');
  const allowances = Object.entries(byCat).map(([label, list]) => ({ id: slug(label), label, monthly: Math.round(list.reduce((a, p) => a + p.amount, 0) / 3) }));

  return { today, windowDays: 34, checking: checking.balance, savings: savings.balance, cushion: 200, income, recurring, allowances,
    goal: { label: 'Emergency fund', target: 2000, saved: savings.balance, left: 4, planned: 300 } };
}
const groupBy = (xs, f) => xs.reduce((m, x) => ((m[f(x)] ||= []).push(x), m), {});
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const addIso = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
