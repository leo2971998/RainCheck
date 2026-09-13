import { transactionRecords } from './records.js';

const iso = d => d.toISOString().slice(0, 10);
const date = s => new Date(s + 'T00:00:00Z');
const money = n => Math.round(n * 100) / 100;
const sum = xs => xs.reduce((a, b) => a + b, 0);
const mean = xs => xs.length ? sum(xs) / xs.length : 0;
const median = xs => { const a = [...xs].sort((x, y) => x - y); return a.length ? (a[Math.floor(a.length / 2)] + a[Math.floor((a.length - 1) / 2)]) / 2 : 0; };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const uniform = [1, 1, 1, 1, 1, 1, 1];
const estimators = { 'recent-average': xs => mean(xs.slice(-3)), 'annual-average': mean, 'recent-median': xs => median(xs.slice(-6)) };
export const MODEL_NAMES = { 'recent-average': 'Recent 3-month average', 'annual-average': 'Available-year average', 'recent-median': 'Recent 6-month median' };
const monthDays = month => Array.from({ length: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);

function fit(values) {
  // Every comparison predicts a month using only months before it.
  const tests = Object.entries(estimators).map(([method, predict]) => ({ method,
    errors: values.slice(3).map((actual, i) => Math.abs(actual - predict(values.slice(0, i + 3)))) }));
  const selected = [...tests].sort((a, b) => mean(a.errors) - mean(b.errors))[0];
  return { method: selected.method, monthly: money(estimators[selected.method](values)),
    mae: selected.errors.length ? money(mean(selected.errors)) : null,
    baselineMae: tests[0].errors.length ? money(mean(tests[0].errors)) : null };
}

function weekdayWeights(rows, months) {
  const totals = uniform.map(() => 0), counts = uniform.map(() => 0);
  for (const m of months) for (const d of monthDays(m)) counts[date(d).getUTCDay()]++;
  for (const r of rows) totals[date(r.date).getUTCDay()] += -r.amount;
  const rates = totals.map((n, i) => n / Math.max(1, counts[i]));
  // Shrink toward uniform so a never-observed weekday is not presented as impossible spending.
  return rates.map(n => n * .8 + mean(rates) * .2);
}

export function projectCategoryMonth(category, month, monthly = category.monthly) {
  const dates = monthDays(month), weights = dates.map(d => (category.timing?.weights || uniform)[date(d).getUTCDay()]);
  const total = sum(weights), cents = Math.max(0, Math.round(monthly * 100));
  let used = 0;
  return dates.map((d, i) => {
    const cumulative = Math.round(cents * sum(weights.slice(0, i + 1)) / (total || dates.length));
    const amount = cumulative - used; used = cumulative;
    return { date: d, amount: amount / 100 };
  });
}

function timing(rows, months) {
  const errors = { uniform: [], weekday: [] };
  for (let i = 3; i < months.length; i++) {
    const earlier = rows.filter(r => r.date.slice(0, 7) < months[i]);
    const actual = rows.filter(r => r.date.startsWith(months[i]));
    const total = sum(actual.map(r => -r.amount));
    // Isolate timing skill: both allocations get the SAME realized monthly total.
    for (const method of Object.keys(errors)) {
      const days = projectCategoryMonth({ monthly: total, timing: { weights: method === 'weekday' ? weekdayWeights(earlier, months.slice(0, i)) : uniform } }, months[i]);
      for (let start = 0; start < days.length; start += 7) {
        const w = days.slice(start, start + 7);
        errors[method].push(Math.abs(sum(w.map(d => d.amount)) - sum(actual.filter(r => r.date >= w[0].date && r.date <= w.at(-1).date).map(r => -r.amount))));
      }
    }
  }
  const enough = months.length >= 6 && rows.length >= 24;
  const method = enough && mean(errors.weekday) < mean(errors.uniform) * .95 ? 'weekday' : 'uniform';
  return { method, weights: method === 'weekday' ? weekdayWeights(rows, months) : uniform,
    weeklyAllocationMae: errors[method].length ? money(mean(errors[method])) : null,
    uniformMae: errors.uniform.length ? money(mean(errors.uniform)) : null,
    note: 'Timing test holds the monthly total fixed; it is not an end-to-end balance accuracy score.' };
}

export function analyzeHistory(snapshot, asOf) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(+date(asOf)) || iso(date(asOf)) !== asOf) throw new Error('Invalid forecast date');
  const through = iso(new Date(+date(asOf) - 864e5));
  const raw = transactionRecords(snapshot, through);
  const rows = [...new Map(raw.map(r => [r.id, r])).values()];
  const current = asOf.slice(0, 7), coverage = snapshot.historyCoverage;
  const months = [];
  for (let i = 12; i >= 1; i--) {
    const d = new Date(Date.UTC(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)) - 1 - i, 1));
    const m = iso(d).slice(0, 7), days = monthDays(m);
    // Unknown coverage is not a zero-spending month. It cannot justify an automatic forecast.
    if (coverage?.complete && coverage.from <= days[0] && coverage.through >= days.at(-1)) months.push(m);
  }
  const training = rows.filter(r => months.includes(r.date.slice(0, 7)));
  const everyday = training.filter(r => r.kind === 'purchase' || r.kind === 'withdrawal');
  const labels = [...new Set(everyday.map(r => r.kind === 'withdrawal' ? 'Cash withdrawals' : r.category))];
  const categories = labels.map(label => {
    const own = everyday.filter(r => (r.kind === 'withdrawal' ? 'Cash withdrawals' : r.category) === label);
    const monthly = months.map(month => ({ month, total: money(sum(own.filter(r => r.date.startsWith(month)).map(r => -r.amount))) }));
    const values = monthly.map(m => m.total), estimate = fit(values);
    return { id: slug(label), label, monthly: estimate.monthly, model: estimate.method,
      observedLow: Math.min(...values), observedHigh: Math.max(...values), transactionCount: own.length, history: monthly,
      validation: { months: Math.max(0, months.length - 3), mae: estimate.mae, baselineMae: estimate.baselineMae,
        folds: monthly.slice(3).map((m, i) => ({ month: m.month, trainedThrough: months[i + 2] })),
        note: 'Model-selection backtest on this history, not independent proof of future accuracy.' },
      timing: timing(own, months) };
  }).sort((a, b) => b.monthly - a.monthly);
  return { asOf, through, synthetic: !!snapshot.synthetic, months, ready: months.length >= 6,
    coverageVerified: !!coverage?.complete, categories,
    monthlyEveryday: money(sum(categories.map(c => c.monthly))),
    partialMonth: { month: current, through, includedInTraining: false,
      spendingSoFar: money(-sum(rows.filter(r => r.date.startsWith(current) && ['purchase', 'withdrawal'].includes(r.kind)).map(r => r.amount))) },
    exclusions: Object.fromEntries([['bills', 'bill'], ['transfers', 'transfer'], ['refunds', 'refund'], ['otherCredits', 'credit']].map(([k, kind]) => [k, training.filter(r => r.kind === kind).length])),
    caveats: ['Unfinished months are excluded from training.', 'Refunds are not income; unlinked refunds are not subtracted from category spending.',
      'Merchant categories come from the sample records. Unknown categories need review, not an AI guess.',
      'Past spending is not a promise. One year is insufficient to establish reliable annual seasonality.'] };
}

// Use the same pattern in the checking engine, including any confirmed category cuts.
// Cached by model identity; simulation may check many savings scenarios against the same data.
const calendars = new WeakMap();
export function spendingOn(h, sc, day) {
  let cache = calendars.get(h.spendingModel);
  if (!cache) { cache = new Map(); calendars.set(h.spendingModel, cache); }
  return money(sum(h.allowances.map(a => {
    const amount = Math.max(0, a.monthly - (sc.cuts?.[a.id] || 0));
    const key = `${a.id}:${day.slice(0, 7)}:${amount}`;
    if (!cache.has(key)) {
      const category = h.spendingModel.categories.find(c => c.id === a.id) || { monthly: amount, timing: { weights: uniform } };
      cache.set(key, projectCategoryMonth(category, day.slice(0, 7), amount));
    }
    return cache.get(key)[Number(day.slice(8)) - 1].amount;
  })));
}
