import { datasetConfig } from './_dataset.js';
import { loadHouseholdContext } from './_household-context.js';
import { localReviewAllowed } from './_local-workspace.js';
import { discoverCommitments } from '../src/engine/discover.js';
import { transactionRecords } from '../src/engine/records.js';
import { householdVersion } from './_review.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ message: 'Use GET to read the household.' });
  try { datasetConfig(req.query?.dataset); }
  catch (err) { return res.status(400).json({ message: err.message }); }
  try {
    const purchasesAvailable = localReviewAllowed(req) && (!req.query?.dataset || req.query.dataset === 'demo');
    const { snapshot: snap, base: household } = await loadHouseholdContext({ dataset: req.query?.dataset, purchases: purchasesAvailable });
    const today = snap.asOf;

    // Bank charges can reveal differences, not a provider's explanation. Do not invent a notice.
    const notice = '', pendingNotices = [];

    // Computed HERE, from the same snapshot the household was built from. The client used to run
    // this against the bundled sample, which meant live balances could be shown beside proposals
    // drawn from a different household's spending.
    const discovered = discoverCommitments(snap, household);

    return res.status(200).json({
      source: snap.source, dataset: snap.dataset, asOf: today, purchasesAvailable, baseVersion: householdVersion(household), household, notice, discovered, pendingNotices,
      transactions: recentTransactions(snap, household),
    });
  } catch (err) {
    return res.status(503).json({ message: err.code === 'PURCHASES_UNAVAILABLE'
      ? 'Your saved purchases couldn’t load. We have paused the forecast so it won’t leave them out. Please try again.'
      : 'Your household couldn’t load. Please try again before using the forecast.' });
  }
}

/** Recent activity for the Transactions page, with the three correctness rules made visible. */
function recentTransactions(snap, household) {
  const billFor = name => household.recurring.find(r => r.payee?.toLowerCase() === name?.toLowerCase());
  const rows = transactionRecords(snap, household.today).map(t => {
    const bill = t.kind === 'bill' ? billFor(t.description) : null;
    const row = { ...t, d: t.date, what: t.description, amt: t.amount, cat: t.category,
      k: { bill: 'rec', income: 'in', transfer: 'tr' }[t.kind] || 'ev' };
    if (bill?.unexplained && -t.amount === bill.lastPosted)
      row.note = `Higher than usual (${fmt(bill.usual ?? bill.amount)}). Not confirmed why.`;
    if (t.kind === 'transfer') row.note = 'Labeled as a transfer by the bank description. Not counted as income or spending.';
    return row;
  });

  // Rule: repeat purchases are not a subscription. Count only the last 30 days, and say it once
  // per merchant on its most recent charge — a note on every row is noise, not information.
  const since = new Date(new Date(household.today + 'T12:00:00') - 30 * 864e5).toISOString().slice(0, 10);
  const counts = {};
  for (const r of rows) if (r.k === 'ev' && r.d >= since) counts[r.what] = (counts[r.what] || 0) + 1;
  const noted = new Set();

  return rows
    .sort((a, b) => b.d.localeCompare(a.d))
    .slice(0, 30)
    .map(r => {
      if (r.k === 'ev' && counts[r.what] >= 4 && !r.note && !noted.has(r.what)) {
        noted.add(r.what);
        r.note = `${counts[r.what]} charges this month. Not treated as a subscription.`;
      }
      return { ...r, d: pretty(r.d) };
    });
}

const pretty = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
