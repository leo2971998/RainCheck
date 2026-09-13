import { loadHouseholdContext } from './_household-context.js';
import { localReviewAllowed } from './_local-workspace.js';
export { localReviewAllowed } from './_local-workspace.js';
import { calculateReview, readReviewPlan, reviewBrief, readSpendingPreferences } from './_review.js';
import { householdFor, scenarioFor, applyPatch } from '../src/engine/plan.js';
import { spendingEvidenceDocuments } from '../src/engine/spending-evidence.js';
import { optimizationDraft, savingsPreview } from '../src/engine/savings-plan.js';
import { simulate } from '../src/engine/forecast.js';
import { forecastEvidenceDocuments } from '../src/engine/forecast-explanation.js';
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
    let base, snapshot, impact, draft;
    let body = req.body;
    try { ({ base, snapshot } = await read()); }
    catch { return res.status(503).json({ message: 'Bank data could not be loaded. Your plan is unchanged; please try again.' }); }
    try {
      impact = calculateReview(base, body);
      if (body.optimize) {
        const saved = readReviewPlan(body.plan, base);
        const protectedIds = readSpendingPreferences(base, body);
        draft = optimizationDraft(base, saved, protectedIds);
        const proposed = savingsPreview(base, saved, draft, protectedIds);
        const { optimize, ...input } = body;
        body = { ...input, patch: proposed.patch, question: 'Review these proposed monthly category limits against recorded spending. Explain the trade-offs, essential and replacement costs, and why someone might accept or change the targets. Do not claim these are optimal, already saved or approved. Keep protected categories unchanged. If no reductions are supported, explain why.' };
        impact = calculateReview(base, body);
      }
    }
    catch (e) { return res.status(e.status || 400).json({ message: e.status === 409 ? e.message
      : 'Some details in this plan could not be reviewed. Check the amounts and dates, then try again.' }); }
    let retrieval;
    try { retrieval = await retrieve(snapshot, body.question); }
    catch { retrieval = { status: 'unavailable', evidence: [] }; }
    let result;
    const savedPlan = readReviewPlan(body.plan, base);
    const savedHousehold = householdFor(base, savedPlan);
    const calculatedEvidence = forecastEvidenceDocuments(savedHousehold, simulate(savedHousehold, scenarioFor(savedHousehold, savedPlan)));
    // Evidence is computed from this snapshot even if the optional search index is unavailable.
    // Preserve the external service's existing four-document limit.
    let spendingEvidence = [];
    if (body.focus === 'spending') {
      const afterPlan = readReviewPlan(applyPatch(savedPlan, body.patch).plan, base);
      const afterHousehold = householdFor(base, afterPlan);
      spendingEvidence = spendingEvidenceDocuments(savedHousehold, scenarioFor(savedHousehold, savedPlan),
        afterHousehold, scenarioFor(afterHousehold, afterPlan), readSpendingPreferences(base, body));
    }
    const evidence = [...spendingEvidence, ...calculatedEvidence, ...retrieval.evidence].slice(0, 4);
    const brief = reviewBrief(impact, body, evidence);
    retrieval = { ...retrieval, evidence, calculatedCount: calculatedEvidence.length };
    try { result = await review(brief); }
    catch { result = { status: 'unavailable', facts: brief, message: 'AI could not finish this review. The calculator results still apply. You can try again.' }; }
    return res.status(200).json({ impact, retrieval, review: result,
      ...(req.body.optimize ? { optimization: result.status === 'complete' && result.result ? { draft } : null } : {}) });
  };
}
export default createHandler();
