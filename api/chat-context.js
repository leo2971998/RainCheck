import { localReviewAllowed } from './_local-workspace.js';
import { loadHouseholdContext } from './_household-context.js';
import { retrieveReviewEvidence } from './_review-evidence.js';
import { calculateChat } from './_chat.js';

export function createContextHandler({ env = process.env, load = loadHouseholdContext, retrieve = retrieveReviewEvidence } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!localReviewAllowed(req, env) || req.headers?.origin !== `http://${req.headers.host}` || req.headers['content-type']?.split(';')[0] !== 'application/json')
      return res.status(403).json({ message: 'Chat calculations are available in the local test workspace only.' });
    if (req.method !== 'POST') return res.status(405).json({ message: 'Ask a question from the chat.' });
    if (!req.body || Buffer.byteLength(JSON.stringify(req.body)) > 16384) return res.status(413).json({ message: 'There is too much information in this request.' });
    if (req.body.consent !== true) return res.status(400).json({ message: 'Please allow cloud chat first.' });
    let base, snapshot, result;
    try { ({ base, snapshot } = await load()); }
    catch { return res.status(503).json({ message: 'The bank data could not be loaded. Please try again.' }); }
    try { result = calculateChat(base, req.body); }
    catch (error) { return res.status(error.status || 400).json({ message: error.status === 409 ? error.message : 'That scenario could not be calculated. Check the amount, bill and date, then try again.' }); }
    let retrieval;
    try { retrieval = await retrieve(snapshot, req.body.args?.question || 'income payroll bills savings'); }
    catch { retrieval = { status: 'unavailable', evidence: [] }; }
    return res.status(200).json({ ...result, retrieval: { status: retrieval.status,
      evidence: retrieval.evidence.slice(0, 4).map(({ title, text, asOf, recordDate }) => ({ title, text, asOf, recordDate })) } });
  };
}
export default createContextHandler();
