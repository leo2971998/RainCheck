import { postedSnapshot, withdrawalKind } from './records.js';

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const round = n => Math.round(n * 100) / 100;
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const middle = values => { const s = [...values].sort((a, b) => a - b); return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2 : 0; };
// Only explicit event wording. A large amount or an unfamiliar merchant is not sufficient.
const eventWording = /\b(?:concert|festival|sporting event)\b.*\b(?:tickets?|admission)\b|\b(?:tickets?|admission)\b.*\b(?:concert|festival|sporting event)\b/i;
const recurringWording = /\b(?:membership|subscription|recurring|monthly|annually|season pass)\b/i;

// Use elapsed calendar months, not an unfinished month divided as though it were complete.
// History coverage is still an assumption; explicitly identified events are not monthly bills.
export function spendingBaseline(snapshot, asOf, lookbackDays = 90) {
  const snap = postedSnapshot(snapshot, asOf);
  const merchants = Object.fromEntries((snap.merchants || []).map(m => [m._id, m]));
  const payees = new Set((snap.bills || []).map(b => b.payee?.toLowerCase()).filter(Boolean));
  const records = (snap.purchases || [])
    .filter(p => daysBetween(p.purchase_date, asOf) <= lookbackDays && !payees.has(merchants[p.merchant_id]?.name?.toLowerCase()))
    .map(p => ({ label: merchants[p.merchant_id]?.category || 'Other', date: p.purchase_date, amount: p.amount,
      merchant: merchants[p.merchant_id]?.name || p.description || 'Event purchase',
      oneTime: eventWording.test(`${merchants[p.merchant_id]?.name || ''} ${p.description || ''}`)
        && !recurringWording.test(`${merchants[p.merchant_id]?.name || ''} ${p.description || ''}`) }));
  const cash = (snap.withdrawals || [])
    .filter(w => withdrawalKind(w) !== 'transfer' && daysBetween(w.transaction_date, asOf) <= lookbackDays)
    .map(w => ({ label: 'Cash withdrawals', date: w.transaction_date, amount: w.amount }));
  const groups = new Map();
  for (const record of [...records, ...cash]) {
    if (!groups.has(record.label)) groups.set(record.label, []);
    groups.get(record.label).push(record);
  }
  const dates = [...records, ...cash].map(r => r.date).sort();
  const cutoff = new Date(Date.parse(asOf + 'T12:00:00Z') - lookbackDays * 864e5).toISOString().slice(0, 10);
  const months = [...new Set(dates.map(d => d.slice(0, 7)))].map(key => ({ key,
    partial: key === asOf.slice(0, 7) || (key === cutoff.slice(0, 7) && !cutoff.endsWith('-01')) }));
  const baselineMonths = months.filter(m => !m.partial).map(m => m.key);
  const divisorMonths = baselineMonths.length || 1;
  const categories = [...groups].map(([label, list]) => {
    const regular = list.filter(r => !r.oneTime);
    const total = round(regular.reduce((s, r) => s + r.amount, 0));
    const keys = [...new Set(list.map(r => r.date.slice(0, 7)))].sort();
    const totals = keys.map(key => {
      const booked = list.filter(r => r.date.startsWith(key));
      const routine = booked.filter(r => !r.oneTime);
      const byDay = new Map();
      for (const r of routine) {
        const day = Number(r.date.slice(8));
        byDay.set(day, round((byDay.get(day) || 0) + r.amount));
      }
      return { key, total: round(routine.reduce((s, r) => s + r.amount, 0)),
        spent: round(booked.reduce((s, r) => s + r.amount, 0)), count: booked.length, regularCount: routine.length,
        daily: [...byDay].sort(([a], [b]) => a - b).map(([day, amount]) => ({ day, amount })) };
    });
    const past = baselineMonths.map(key => totals.find(m => m.key === key)?.total || 0);
    const hasPast = past.some(n => n > 0);
    const basis = hasPast ? past : totals.map(m => m.total);
    return { id: slug(label), label, monthly: Math.round(middle(basis)), total, count: regular.length,
      months: totals, observedRange: basis.length ? [Math.min(...basis), Math.max(...basis)] : [0, 0],
      provisional: !hasPast && total > 0 };
  }).sort((a, b) => a.label === 'Cash withdrawals' ? 1 : b.label === 'Cash withdrawals' ? -1 : b.monthly - a.monthly);
  return {
    allowances: categories.map(({ id, label, monthly }) => ({ id, label, monthly })),
    evidence: { asOf, from: dates[0] || null, through: dates.at(-1) || null, lookbackDays, divisorMonths,
      months, baselineMonths, categories, monthly: round(categories.reduce((s, c) => s + c.monthly, 0)),
      oneOffs: records.filter(r => r.oneTime).map(r => ({ label: r.merchant, category: r.label, amount: r.amount, date: r.date,
        reason: 'Event-ticket wording; assumed one-time, not proof of future spending.' })),
      count: dates.length,
      coverageNote: 'Dates show records found, not proof that every transaction was imported. The current month and any month cut short by the lookback are not used as full months when earlier complete periods exist.' },
  };
}
