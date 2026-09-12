// src/engine/household.js
// Turns raw Nessie records into the household shape the forecast engine expects.

const groupBy = (xs, f) => xs.reduce((m, x) => { const k = f(x); (m[k] ||= []).push(x); return m; }, {});
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const addIso = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const round2 = n => Math.round(n * 100) / 100;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Build the household from a Nessie snapshot.
 *
 * Three correctness rules are enforced here, because this is the only place they can be:
 *   1. Transfers are not income. We read /deposits only.
 *   2. A bill and its posted charge are ONE expense, not two. Every bill also lands as a purchase,
 *      so purchases from a bill payee are excluded from spending categories. Without this the rent
 *      appears both as a $1,150 bill and a $1,150/month "Rent" allowance, which doubles daily
 *      spending and sends the forecast hundreds of dollars under.
 *   3. Repeat purchases are not a subscription. Purchases only ever feed allowances; a commitment
 *      becomes "recurring" only when the bank says it is a bill.
 */
export function buildHousehold(snap, today, opts = {}) {
  const { cushion = 200, windowDays = 34, goalTarget = 2000, goalLeft = 4, goalPlanned = 300, lookbackDays = 90 } = opts;

  const accounts = snap.accounts || [];
  const checking = accounts.find(a => a.type === 'Checking');
  const savings = accounts.find(a => a.type === 'Savings');
  if (!checking) throw new Error('No Checking account in the snapshot.');

  // --- Recurring commitments: the bank's bills are the source of truth. ---
  const recurring = (snap.bills || []).map(b => {
    const day = b.recurring_date ?? Number(String(b.payment_date).slice(8, 10));
    const cancellable = /gym|fitness|streaming|subscription|membership/i.test(`${b.nickname} ${b.payee}`);
    return {
      id: slug(b.nickname || b.payee),
      label: b.nickname || b.payee,
      payee: b.payee,
      amount: b.payment_amount,
      day,
      ...frequencyOf(b, snap),
      cancellable,
      // A cancellable commitment renews on its next billing date. The Compare drawer offers
      // reviewing it only while that date is still ahead.
      ...(cancellable ? { renews: nextOccurrence(today, day) } : {}),
    };
  }).sort((a, b) => a.day - b.day);

  // --- Expected income: find the deposit description that repeats, measure its cadence, project. ---
  const deposits = [...(snap.deposits || [])].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
  const series = Object.values(groupBy(deposits, d => d.description)).sort((a, b) => b.length - a.length)[0] || [];
  const cadence = series.length >= 2
    ? Math.round(series.slice(1).reduce((a, d, i) => a + daysBetween(series[i].transaction_date, d.transaction_date), 0) / (series.length - 1))
    : 14;
  const last = series[series.length - 1];
  const income = [];
  if (last) {
    let date = last.transaction_date;
    while (income.length < 3) {
      date = addIso(date, cadence);
      if (date < today) continue;
      income.push({
        id: 'p' + (income.length + 1),
        label: last.description || 'Paycheck',
        date,
        amount: last.amount,
        // Estimated, all of them. Being next in an inferred sequence is not confirmation, and
        // labelling it 'confirmed' made the forecast look more certain than the evidence allows.
        // Only the user editing a figure marks it as something they stand behind.
        status: 'estimated',
      });
    }
  }

  // --- Everyday allowances: purchases by merchant category, excluding bill postings (rule 2). ---
  const merchant = Object.fromEntries((snap.merchants || []).map(m => [m._id, m]));
  const payees = new Set(recurring.map(r => r.payee?.toLowerCase()).filter(Boolean));
  const isBillPosting = p => payees.has(merchant[p.merchant_id]?.name?.toLowerCase());

  const purchases = snap.purchases || [];
  const recent = purchases.filter(p => daysBetween(p.purchase_date, today) <= lookbackDays);
  const spending = recent.filter(p => !isBillPosting(p));
  const monthsCovered = Math.max(1, Math.round(lookbackDays / 30));
  const allowances = Object.entries(groupBy(spending, p => merchant[p.merchant_id]?.category || 'Other'))
    .map(([label, list]) => ({ id: slug(label), label, monthly: Math.round(list.reduce((a, p) => a + p.amount, 0) / monthsCovered) }))
    .sort((a, b) => b.monthly - a.monthly);

  // --- History for the cash-flow chart: real money in and out, per calendar month. ---
  const history = monthlyHistory(snap, today, monthsCovered);

  // --- Goal: the real savings balance, read every time. Never a cached number. ---
  // Contributions land on the same date each month, not every 30 days.
  const first = income[0]?.date || today;
  const months = Array.from({ length: goalLeft }, (_, i) => {
    const d = new Date(first + 'T12:00:00');
    return new Date(d.getFullYear(), d.getMonth() + i, d.getDate(), 12).toISOString().slice(0, 10);
  });
  const goal = {
    label: savings?.nickname || 'Savings goal',
    target: goalTarget,
    saved: savings?.balance ?? 0,
    left: goalLeft,
    planned: goalPlanned,
    months: months.map(d => { const x = new Date(d + 'T12:00:00'); return `${MONTH_NAMES[x.getMonth()]} ${x.getDate()}`; }),
  };

  return {
    today, windowDays, cushion,
    checking: checking.balance,
    savings: savings?.balance ?? 0,
    accountIds: { checking: checking._id, savings: savings?._id },
    income, recurring, allowances, history, goal,
  };
}

/** The next time a day-of-month falls, on or after `today`. */
function nextOccurrence(today, day) {
  const d = new Date(today + 'T12:00:00');
  const thisMonth = new Date(d.getFullYear(), d.getMonth(), day, 12);
  const when = thisMonth >= d ? thisMonth : new Date(d.getFullYear(), d.getMonth() + 1, day, 12);
  return when.toISOString().slice(0, 10);
}

/** Income against spending for each of the last `n` complete-ish months. */
function monthlyHistory(snap, today, n = 3) {
  const out = [];
  const start = new Date(today + 'T12:00:00');
  for (let i = n - 1; i >= 0; i--) {      // includes the current month, which is nearly complete
    const m = new Date(start.getFullYear(), start.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    const inc = (snap.deposits || []).filter(d => d.transaction_date.startsWith(key)).reduce((a, d) => a + d.amount, 0);
    const spent = (snap.purchases || []).filter(p => p.purchase_date.startsWith(key)).reduce((a, p) => a + p.amount, 0)
      + (snap.withdrawals || []).filter(w => w.transaction_date.startsWith(key)).reduce((a, w) => a + w.amount, 0);
    if (inc || spent) out.push({ m: MONTH_NAMES[m.getMonth()], inc: round2(inc), out: round2(spent) });
  }
  return out;
}

/**
 * Compare each bill against its most recent posted charge.
 * A difference is reported as UNEXPLAINED — never as a price change. Only a notice can establish
 * that. The forecast does not move until the user chooses "one-time" or "new price".
 */
export function detectPostedChanges(household, snap, { tolerance = 0.10 } = {}) {
  const merchant = Object.fromEntries((snap.merchants || []).map(m => [m._id, m]));
  return household.recurring.map(r => {
    if (!r.payee) return r;
    const posted = (snap.purchases || [])
      .filter(p => merchant[p.merchant_id]?.name?.toLowerCase() === r.payee.toLowerCase())
      .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));
    const latest = posted[0];
    if (!latest || Math.abs(latest.amount - r.amount) / r.amount <= tolerance) return r;
    const earlier = posted.slice(1, 4);
    return {
      ...r,
      lastPosted: latest.amount,
      lastPostedDate: latest.purchase_date,
      // Rounded once, here. Every Nessie amount is whole dollars anyway, and rounding the average
      // in two places made the alert say "$21 higher" while the detail said "usually $108".
      usual: earlier.length ? Math.round(earlier.reduce((a, p) => a + p.amount, 0) / earlier.length) : r.amount,
      unexplained: true,
    };
  });
}

/** Attach a parsed notice to the bill it names, and record the size of the increase. */
export function applyNotice(recurring, notice, change) {
  if (!change) return recurring;
  const from = (/From:\s*([^<\n]+)/.exec(notice)?.[1] || '').trim().toLowerCase();
  return recurring.map(r => {
    const names = [r.payee, r.label].filter(Boolean).map(s => s.toLowerCase());
    const match = names.some(nm => from.includes(nm) || nm.split(' ').some(word => word.length > 3 && from.includes(word)));
    return match ? { ...r, change: { ...change, increase: round2(change.to - r.amount) } } : r;
  });
}

/**
 * How often a commitment actually posts, inferred from its own charge history rather than assumed.
 *
 * Every bill used to be labelled Monthly, which quietly misrepresents an annual renewal: it would
 * appear twelve times a year at a twelfth of the impact it really has. Nessie only carries a
 * day-of-month, so the posted charges are the only evidence of the real cycle.
 */
function frequencyOf(bill, snap) {
  const merchant = Object.fromEntries((snap.merchants || []).map(m => [m._id, m]));
  const posted = (snap.purchases || [])
    .filter(p => merchant[p.merchant_id]?.name?.toLowerCase() === bill.payee?.toLowerCase())
    .map(p => p.purchase_date)
    .sort();

  if (posted.length < 2) return { freq: 'Monthly', everyMonths: 1 };

  const gaps = posted.slice(1).map((d, i) => daysBetween(posted[i], d));
  const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  const everyMonths = median >= 300 ? 12 : median >= 150 ? 6 : median >= 75 ? 3 : 1;
  const freq = { 1: 'Monthly', 3: 'Quarterly', 6: 'Twice a year', 12: 'Annual' }[everyMonths];
  return { freq, everyMonths, anchor: posted[posted.length - 1] };
}
