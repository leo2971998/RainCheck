import { purchaseAccess, purchaseOriginAllowed, checkPurchaseLimit } from './_purchase-access.js';
import { loadHouseholdContext } from './_household-context.js';
import { savePurchase } from './_purchases.js';
import { householdVersion } from './_review.js';
import { readPurchase, matchCandidates, confirmPurchaseMatch } from '../src/engine/purchases.js';
import { transactionRecords } from '../src/engine/records.js';

const conflict = () => { const error = new Error('Your saved plans or bank data changed. Refresh before continuing.'); error.status = 409; throw error; };
export function createPurchaseHandler({ env = process.env, load = loadHouseholdContext, save = savePurchase, limit } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const mode = purchaseAccess(req, env);
    if (!mode) return res.status(403).json({ message: 'Open the connected RainCheck demo to use saved purchases.' });
    if (!['GET','POST','PUT','DELETE'].includes(req.method)) return res.status(405).json({ message: 'Use the purchase form to make changes.' });
    if (!purchaseOriginAllowed(req, mode, env))
      return res.status(403).json({ message: 'Open RainCheck to change your plans.' });
    const body = req.body;
    if (req.method !== 'GET' && (!body || Buffer.byteLength(JSON.stringify(body)) > 8192)) return res.status(400).json({ message: 'Check the purchase details.' });
    if (mode === 'shared' && req.method !== 'GET' && !await checkPurchaseLimit(req, res, env, limit)) return;
    let base, snapshot;
    try { ({ base, snapshot } = await load({ live: mode === 'shared' || body?.action === 'match' || Boolean(req.query?.candidates) })); }
    catch { return res.status(503).json({ message: 'Saved plans or bank records couldn’t load. Nothing changed. Please try again.' }); }
    try {
      const all = base.plannedPurchases || [];
      if (req.method === 'GET') {
        if (!req.query?.candidates) return res.status(200).json({ purchases: all, baseVersion: householdVersion(base) });
        const p = all.find(p => p.id === req.query.candidates); if (!p) conflict();
        return res.status(200).json({ candidates: matchCandidates(p, transactionRecords(snapshot, base.today), all, base.today), baseVersion: householdVersion(base) });
      }
      if (body.baseVersion !== householdVersion(base)) conflict();
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(body.id || '') || !Number.isInteger(body.revision) || body.revision < 0)
        return res.status(400).json({ message: 'Refresh this purchase and try again.' });
      const previous = all.find(p => p.id === body.id);
      let record;
      if (body.action === 'match') {
        if (req.method !== 'POST' || !previous || previous.revision !== body.revision) conflict();
        const transaction = transactionRecords(snapshot, base.today).find(t => t.id === body.transactionId);
        record = confirmPurchaseMatch(previous, transaction, all, base.today, body.confirmed);
      } else if (req.method === 'POST') {
        if (previous || body.revision !== 0) conflict();
        record = { ...readPurchase(body.draft, base), status: 'planned' };
      } else {
        if (!previous || previous.status !== 'planned' || previous.revision !== body.revision) conflict();
        record = req.method === 'DELETE' ? { ...previous, status: 'cancelled' } : { ...readPurchase(body.draft, base), status: 'planned' };
      }
      let purchase;
      try { purchase = await save(body.id, body.revision, record); }
      catch (e) {
        return res.status(e.status || 503).json({ message: e.status === 409 ? 'This purchase or charge was already updated. Refresh before continuing.'
          : 'The save could not be confirmed. Refresh your purchases before trying again.' });
      }
      return res.status(200).json({ purchase });
    } catch (e) { return res.status(e.status || 400).json({ message: e.message || 'Check the purchase details.' }); }
  };
}
export default createPurchaseHandler();
