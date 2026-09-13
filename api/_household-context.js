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
    // A purchase saved against a different account is not this household's purchase, so leaving it
    // out omits nothing. Refusing to build the forecast at all was the harsher reading, and it had
    // no way out: the save RPC treats completed and cancelled purchases as immutable, so once the
    // sandbox account was rebuilt the stale rows could never be repointed or deleted, and every
    // request failed permanently. They are set aside and counted instead, so the mismatch is still
    // visible without taking the whole plan down.
    const foreign = base.plannedPurchases.filter(p => p.accountId !== base.checkingId);
    if (foreign.length) base.plannedPurchases = base.plannedPurchases.filter(p => p.accountId === base.checkingId);
    base.foreignPurchases = foreign.length;
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
