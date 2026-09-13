import { simulate, projectIncome, scheduleUntil } from './forecast.js';
import { purchaseSchedule, spendingDayDivisor } from './purchases.js';

const round = n => Math.round(n * 100) / 100;
const day = s => Date.parse(s + 'T12:00:00Z') / 86400000;
export function nextForecastMonth(asOf, offset = 1) {
  return new Date(Date.UTC(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)) - 1 + offset, 1)).toISOString().slice(0, 7);
}

// One monthly story, sourced from the same dated calculation used by the homepage.
export function monthlyOutlook(h, sc, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < h.today.slice(0, 7) || month > nextForecastMonth(h.today, 12))
    throw new Error('Choose a month in the next year.');
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0, 12)).toISOString().slice(0, 10);
  const start = h.today > month + '-01' ? h.today : month + '-01';
  const income = projectIncome({ ...h, income: sc.income || h.income }, end);
  const contributionDates = sc.contributionDates ?? scheduleUntil({ ...h, income }, h.goal?.targetDate && h.goal.targetDate < end ? h.goal.targetDate : end);
  const scenario = { ...sc, income, contributionDates };
  const sim = simulate(h, scenario, { days: day(end) - day(h.today) + 1 });
  const days = sim.days.filter(d => d.key.startsWith(month));
  const events = days.flatMap(d => d.events.map(e => ({ ...e, date: d.key })));
  const sum = flag => round(events.filter(e => e[flag]).reduce((s, e) => s + e.amt, 0));
  const schedule = purchaseSchedule(h, scenario);
  const planned = (h.plannedPurchases || []).filter(p => p.status === 'planned' && schedule.allocations[p.id]?.effectiveDate.startsWith(month))
    .map(p => ({ ...p, ...schedule.allocations[p.id] }));
  const rows = h.allowances.map(a => {
    const historical = h.spendingEvidence?.categories.find(c => c.id === a.id);
    return { id: a.id, label: a.label, usual: a.monthly,
      expected: round(Math.max(0, a.monthly - (sc.cuts?.[a.id] || 0)) / spendingDayDivisor(h, start) * days.length),
      range: historical?.observedRange, provisional: historical?.provisional,
      kind: 'everyday', details: historical ? `Based on ${historical.count} recorded purchases.` : 'Your current monthly estimate.' };
  }).filter(r => r.expected || r.usual);
  const bills = events.filter(e => e.bill).map(e => {
    const r = h.recurring.find(r => r.id === e.id);
    return { label: e.label, amount: -e.amt, date: e.date, usual: r?.amount || 0,
      utilities: /utilities|electric|internet|water|natural gas/i.test(`${r?.category || ''} ${r?.label || ''}`) };
  });
  for (const utilities of [true, false]) {
    const group = bills.filter(b => b.utilities === utilities);
    if (group.length) rows.push({ id: utilities ? 'utility-bills' : 'other-bills', label: utilities ? 'Utilities & internet' : 'Rent & other bills',
      kind: 'bill', usual: round(group.reduce((s, b) => s + b.usual, 0)), expected: round(group.reduce((s, b) => s + b.amount, 0)),
      details: group.map(b => `${b.label}: $${round(b.amount)}`).join(' · ') });
  }
  const extra = round(planned.reduce((s, p) => s + p.extra, 0));
  const spending = round(-sum('bill') - sum('everyday') - sum('purchase'));
  return { month, start, end, partial: start !== month + '-01', rows, bills, planned, extra, spending,
    usualCosts: round(spending - extra), savings: -sum('transfer'), income: sum('pay'),
    leftAfterSaving: round(sum('pay') - spending + sum('transfer')),
    changes: bills.filter(b => round(b.amount) !== round(b.usual)),
    oneOffs: h.spendingEvidence?.oneOffs || [],
    low: days.reduce((a, b) => a.balance < b.balance ? a : b),
    unplannedCostsKnown: false, sim };
}
