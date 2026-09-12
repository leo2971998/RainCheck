import { readFile } from 'node:fs/promises';
import { loadSnapshotLike } from './_nessie.js';
import { buildHousehold, detectPostedChanges, applyNotice } from '../src/engine/household.js';
import { parseNotice } from '../src/engine/changes.js';
import { discoverCommitments } from '../src/engine/discover.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ message: 'Use GET to read the household.' });
  try {
    const snap = await loadSnapshotLike();
    const today = process.env.VITE_DEMO_DATE || new Date().toISOString().slice(0, 10);

    const household = buildHousehold(snap, today);
    const notice = await readFile(new URL('../data/notice-internet.txt', import.meta.url), 'utf8');

    // A charge that came in higher than expected is something the BANK told us, so it belongs to
    // the household. A provider notice is not: RainCheck has no mailbox, and a bank's transaction
    // history cannot contain a price that has not been charged yet.
    //
    // So the bundled notice is NOT applied here. It is offered as an example waiting to be
    // reviewed, and it only reaches the forecast once the user accepts it — by the same path a
    // notice they pasted themselves would take.
    household.recurring = detectPostedChanges(household, snap);

    // Computed HERE, from the same snapshot the household was built from. The client used to run
    // this against the bundled sample, which meant live balances could be shown beside proposals
    // drawn from a different household's spending.
    const discovered = discoverCommitments(snap, household);

    const change = parseNotice(notice, new Date(today).getFullYear());
    const pendingNotices = change ? [{
      id: 'example-internet',
      text: notice,
      origin: 'example',
      originLabel: 'Example notice included with this demo',
    }] : [];

    return res.status(200).json({
      source: snap.source, household, notice, discovered, pendingNotices,
      transactions: recentTransactions(snap, household),
    });
  } catch (err) {
    return res.status(503).json({ message: 'Sandbox data is not available yet. You can still use the sample workspace.', detail: String(err?.message || err) });
  }
}

/** Recent activity for the Transactions page, with the three correctness rules made visible. */
function recentTransactions(snap, household) {
  const merchant = Object.fromEntries((snap.merchants || []).map(m => [m._id, m]));
  const payees = new Set(household.recurring.map(r => r.payee?.toLowerCase()).filter(Boolean));
  const billFor = name => household.recurring.find(r => r.payee?.toLowerCase() === name?.toLowerCase());

  const rows = [
    ...(snap.purchases || []).map(p => {
      const m = merchant[p.merchant_id];
      const name = m?.name || p.description;
      const bill = payees.has(name?.toLowerCase()) ? billFor(name) : null;
      const row = { d: p.purchase_date, what: name, amt: -p.amount, cat: bill ? bill.label : (m?.category || 'Other'), k: bill ? 'rec' : 'ev' };
      // Rule: a bill and its posting are one expense. Say so where the user can see it.
      if (bill && bill.unexplained && p.amount === bill.lastPosted)
        row.note = `Higher than usual (${fmt(bill.usual ?? bill.amount)}). Not confirmed why.`;
      return row;
    }),
    ...(snap.deposits || []).map(d => ({ d: d.transaction_date, what: d.description, amt: d.amount, cat: 'Income', k: 'in' })),
    ...(snap.withdrawals || []).map(w => ({ d: w.transaction_date, what: w.description, amt: -w.amount, cat: 'Transfer', k: 'tr', note: 'Your own savings account. Not counted as spending.' })),
  ];

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
