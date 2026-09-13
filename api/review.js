import { loadHouseholdContext } from './_household-context.js';
import { reviewAccess, reviewOriginAllowed, checkReviewLimit, savedReviewToken, savedReviewAllowed } from './_review-access.js';
export { localReviewAllowed } from './_local-workspace.js';
import { calculateReview, readReviewPlan, reviewBrief, readSpendingPreferences } from './_review.js';
import { householdFor, scenarioFor, applyPatch } from '../src/engine/plan.js';
import { spendingEvidenceDocuments } from '../src/engine/spending-evidence.js';
import { optimizationDraft, savingsPreview, savingsNeeds } from '../src/engine/savings-plan.js';
import { simulate } from '../src/engine/forecast.js';
import { forecastEvidenceDocuments } from '../src/engine/forecast-explanation.js';
import { purchaseEvidenceDocuments } from '../src/engine/purchase-impact.js';
import { retrieveReviewEvidence } from './_review-evidence.js';
import { requestReview, savedReview } from './_zeroclaw.js';

export function createHandler({ env = process.env, load: read = loadHouseholdContext, retrieve = retrieveReviewEvidence,
  review = requestReview, getSaved = savedReview, limit } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const mode = reviewAccess(req, env);
    if (req.method === 'GET' && !req.query?.id) return res.status(200).json({ available: !!mode, publicDemo: mode === 'shared' });
    if (!mode) return res.status(403).json({ message: 'AI analysis is not available on this version yet. Your budgets are unchanged.' });
    if (!reviewOriginAllowed(req, mode, env)) return res.status(403).json({ message: 'Open RainCheck to ask for a review.' });
    if (req.method === 'GET') {
      if (mode === 'shared') {
        if (!savedReviewAllowed(req.query, env)) return res.status(403).json({ message: 'Open this review using its original saved link.' });
        if (!await checkReviewLimit(req, res, env, limit)) return;
      }
      try { return res.status(200).json({ review: { ...await getSaved(req.query.id, { env }),
        ...(mode === 'shared' ? { accessToken: req.query.token } : {}) } }); }
      catch { return res.status(404).json({ message: 'This saved review could not be opened.' }); }
    }
    if (req.method !== 'POST') return res.status(405).json({ message: 'Use the review form to ask a question.' });
    if (!req.body || Buffer.byteLength(JSON.stringify(req.body)) > 16384)
      return res.status(413).json({ message: 'This review is too large. Please shorten the question or plan.' });
    if (req.body.consent !== true) return res.status(400).json({ message: 'Please allow cloud review before sending.' });
    if (mode === 'shared' && !await checkReviewLimit(req, res, env, limit)) return;
    let base, snapshot, impact, draft, recovery;
    let body = req.body;
    try { ({ base, snapshot } = await read(mode === 'shared' ? { live: true } : undefined)); }
    catch { return res.status(503).json({ message: 'Bank data could not be loaded. Your plan is unchanged; please try again.' }); }
    try {
      impact = calculateReview(base, body);
      if (body.optimize) {
        const saved = readReviewPlan(body.plan, base);
        const protectedIds = readSpendingPreferences(base, body);
        draft = optimizationDraft(base, saved, protectedIds);
        const proposed = savingsPreview(base, saved, draft, protectedIds);
        recovery = proposed.guidance.recovery;
        const { optimize, ...input } = body;
        body = { ...input, patch: proposed.patch, question: 'Explain whether the recovery objective is met, separately from existing goal funding. If recovery is short, say cuts do not solve the overspend and suggest reviewing purchases, editing limits or a later recovery date. Never claim goal affordability means recovery is solved. Over-budget categories stay unchanged for purchase review; costs may be one-time. Respect essentials and replacement costs. A dated cash gap is not a monthly fee. Do not claim money saved or changes approved.' };
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
        afterHousehold, scenarioFor(afterHousehold, afterPlan), readSpendingPreferences(base, body), savingsNeeds(base, savedPlan, draft?.extras), recovery);
    }
    const evidence = [...purchaseEvidenceDocuments(impact), ...spendingEvidence, ...calculatedEvidence, ...retrieval.evidence].slice(0, 4);
    const brief = reviewBrief(impact, body, evidence);
    retrieval = { ...retrieval, evidence, calculatedCount: calculatedEvidence.length };
    try {
      result = await review(brief, { env });
      if (mode === 'shared' && result.status === 'complete' && result.id)
        result = { ...result, accessToken: savedReviewToken(result.id, env) };
    }
    catch { result = { status: 'unavailable', facts: brief, message: 'AI could not finish this review. The calculator results still apply. You can try again.' }; }
    return res.status(200).json({ impact, retrieval, review: result,
      ...(req.body.optimize ? { optimization: result.status === 'complete' && result.result ? { draft } : null } : {}) });
  };
}
export default createHandler();
