import { expect, it } from 'vitest';
import snapshot from '../data/nessie-snapshot.json';
import { loadHouseholdContext } from '../api/_household-context.js';
import { transactionRecords } from '../src/engine/records.js';
const snap = { ...snapshot, asOf: '2026-09-28' };
it('does not lose completed purchase charges when a bank snapshot falls behind', async () => {
  const charge = transactionRecords(snap, snap.asOf).find(t => t.kind === 'purchase');
  const p = { id: 'example', accountId: snap.checkingId, status: 'completed', transactionId: charge.id, actualAmount: -charge.amount, actualDate: charge.date };
  const read = async () => snap, list = async () => [p];
  expect((await loadHouseholdContext({}, { read, list })).base.plannedPurchases).toEqual([p]);
  await expect(loadHouseholdContext({}, { read, list: async () => [{ ...p, transactionId: 'purchase:missing' }] })).rejects.toMatchObject({ code: 'PURCHASES_UNAVAILABLE' });
});
it('blocks instead of calculating without saved purchases when the database is unavailable', async () => {
  await expect(loadHouseholdContext({}, { read: async () => snap, list: async () => { throw new Error('DB offline'); } })).rejects.toMatchObject({ code: 'PURCHASES_UNAVAILABLE' });
});
