import { readFile } from 'node:fs/promises';
import { loadSnapshotLike } from './_nessie.js';
import { buildHousehold } from '../src/engine/household.js';
import { detectPostedChanges, parseNotice } from '../src/engine/changes.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ message: 'Use GET to read the household.' });
  try {
    const snap = await loadSnapshotLike();
    const today = process.env.VITE_DEMO_DATE || new Date().toISOString().slice(0, 10);
    const h = buildHousehold(snap, today);
    h.recurring = detectPostedChanges(h, snap.purchases, snap.merchants);
    const notice = await readFile(new URL('../data/notice-internet.txt', import.meta.url), 'utf8');
    const change = parseNotice(notice);
    const internet = h.recurring.find(r => r.id === 'internet');
    if (change && internet) internet.change = change;
    return res.status(200).json({ source: snap.source, household: h, notice, transactions: recentTransactions(snap) });
  } catch {
    return res.status(503).json({ message: 'Sandbox data is not available yet. You can still use the sample workspace.' });
  }
}

function recentTransactions(snap) {
  const name = Object.fromEntries(snap.merchants.map(m => [m._id, m.name]));
  return [
    ...snap.purchases.map(p => ({ d: p.purchase_date, what: name[p.merchant_id] || p.description, amt: -p.amount, k: 'ev' })),
    ...snap.deposits.map(d => ({ d: d.transaction_date, what: d.description, amt: d.amount, k: 'in' })),
  ].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 30);
}
