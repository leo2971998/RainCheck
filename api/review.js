import { loadHouseholdContext } from './_household-context.js';
import { localReviewAllowed } from './_local-workspace.js';
export { localReviewAllowed } from './_local-workspace.js';
import { calculateReview, reviewBrief } from './_review.js';
import { retrieveReviewEvidence } from './_review-evidence.js';
import { requestReview, savedReview } from './_zeroclaw.js';

export function createHandler({ env = process.env, load: read = loadHouseholdContext, retrieve = retrieveReviewEvidence, review = requestReview } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const enabled = localReviewAllowed(req, env);
    if (req.method === 'GET' && !req.query?.id) return res.status(200).json({ available: enabled });
    if (!enabled) return res.status(403).json({ message: 'AI review is available only in the local test workspace for now.' });
    if (req.method === 'GET') {
      try { return res.status(200).json({ review: await savedReview(req.query.id) }); }
      catch { return res.status(404).json({ message: 'This saved review could not be opened.' }); }
    }
    if (req.method !== 'POST') return res.status(405).json({ message: 'Use the review form to ask a question.' });
    if (req.headers?.origin !== `http://${req.headers.host}` || req.headers['content-type']?.split(';')[0] !== 'application/json')
      return res.status(403).json({ message: 'Open RainCheck locally to ask for a review.' });
    if (!req.body || Buffer.byteLength(JSON.stringify(req.body)) > 16384)
      return res.status(413).json({ message: 'This review is too large. Please shorten the question or plan.' });
    if (req.body.consent !== true) return res.status(400).json({ message: 'Please allow cloud review before sending.' });
    let base, snapshot, impact;
    try { ({ base, snapshot } = await read()); }
    catch { return res.status(503).json({ message: 'Bank data could not be loaded. Your plan is unchanged; please try again.' }); }
    try { impact = calculateReview(base, req.body); }
    catch (e) { return res.status(e.status || 400).json({ message: e.status === 409 ? e.message
      : 'Some details in this plan could not be reviewed. Check the amounts and dates, then try again.' }); }
    let retrieval;
    try { retrieval = await retrieve(snapshot, req.body.question); }
    catch { retrieval = { status: 'unavailable', evidence: [] }; }
    let result;
    const brief = reviewBrief(impact, req.body, retrieval.evidence);
    try { result = await review(brief); }
    catch { result = { status: 'unavailable', facts: brief, message: 'AI could not finish this review. The calculator results still apply. You can try again.' }; }
    return res.status(200).json({ impact, retrieval, review: result });
  };
}
export default createHandler();
