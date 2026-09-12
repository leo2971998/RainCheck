import { readDataset, datasetConfig } from './_dataset.js';
import { transactionPage } from './_transactions.js';
import { transactionRecords } from '../src/engine/records.js';

// Read-only sandbox data. Do not add writes here until per-user authorization exists.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ message: 'Use GET to read transactions.' });
  const query = req.query || {};
  try { transactionPage([], query); datasetConfig(query.dataset); }
  catch (err) { return res.status(400).json({ message: err.message }); }
  if (!process.env.NESSIE_KEY) return res.status(503).json({ message: 'The sandbox is not configured.' });
  try {
    const snap = await readDataset(query.dataset);
    const accountId = query.accountId || snap.checkingId;
    if (!snap.accounts.some(a => a._id === accountId)) return res.status(404).json({ message: 'Account not found in this household.' });
    const asOf = snap.asOf;
    return res.status(200).json({ source: snap.source, dataset: snap.dataset, asOf, accountId,
      accounts: snap.accounts.map(a => ({ id: a._id, type: a.type, nickname: a.nickname })),
      ...transactionPage(transactionRecords(snap, asOf, accountId), query) });
  } catch { return res.status(503).json({ message: 'Live bank history is unavailable. No sample records were substituted.' }); }
}
