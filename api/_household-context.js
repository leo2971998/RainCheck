import { readDataset } from './_dataset.js';
import { buildHousehold, detectPostedChanges } from '../src/engine/household.js';
import { listPurchases } from './_purchases.js';
import { transactionRecords } from '../src/engine/records.js';

export async function loadHouseholdContext({ dataset = 'demo', purchases = true, live = false } = {}, { read = readDataset, list = listPurchases } = {}) {
  const snapshot = await read(dataset, { allowSnapshot: !live });
  const base = buildHousehold(snapshot, snapshot.asOf);
  base.recurring = detectPostedChanges(base, snapshot);
  base.checkingId = snapshot.checkingId;
  if (purchases) {
    try { base.plannedPurchases = await list(); }
    catch { const error = new Error('Saved purchases could not load.'); error.code = 'PURCHASES_UNAVAILABLE'; throw error; }
    if (base.plannedPurchases.some(p => p.accountId !== base.checkingId)) {
      const error = new Error('Saved purchases belong to a different demo account.'); error.code = 'PURCHASES_UNAVAILABLE'; throw error;
    }
    const posted = new Map(transactionRecords(snapshot, base.today).map(t => [t.id, t]));
    if (base.plannedPurchases.filter(p => p.status === 'completed').some(p => {
      const charge = posted.get(p.transactionId);
      return !charge || charge.amount !== -p.actualAmount || charge.date !== p.actualDate;
    })) {
      const error = new Error('Bank history no longer agrees with a completed purchase.'); error.code = 'PURCHASES_UNAVAILABLE'; throw error;
    }
  }
  return { base, snapshot };
}
