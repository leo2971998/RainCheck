// Reviews describe one posted charge. They never establish why a company charged it.
export const billReviewKey = r => [r.id, r.lastPostedId || r.lastPostedDate, Math.round(r.lastPosted * 100)].join('__');
export const reviewForBill = (r, plan = {}) => plan.billReviews?.[billReviewKey(r)];
export function needsBillReview(r, plan = {}) {
  if (!r.unexplained || plan.cancelled?.[r.id]) return false;
  const review = reviewForBill(r, plan);
  if (review) return !review.reviewed;
  return !Object.hasOwn(plan.treatAsNewPrice || {}, r.id);
}

export function latestBillEstimate(r, plan = {}, through = '9999-12-31') {
  const records = Object.values(plan.billReviews || {}).filter(v => v?.billId === r.id && v.postedDate <= through);
  records.sort((a, b) => b.postedDate.localeCompare(a.postedDate) || b.updatedAt.localeCompare(a.updatedAt));
  return records[0]?.forecastAmount;
}

export const NEXT_STEPS = { contact: 'Ask the company', watch: 'Watch the next bill', done: 'No follow-up needed' };
export function createBillReview(r, { forecastAmount, nextStep }, updatedAt = new Date().toISOString()) {
  if (!Number.isFinite(forecastAmount) || forecastAmount < 0 || forecastAmount > 1000000
    || Math.abs(forecastAmount * 100 - Math.round(forecastAmount * 100)) > 1e-6 || !Object.hasOwn(NEXT_STEPS, nextStep)) {
    throw new Error('Choose a valid estimate and next step.');
  }
  return { billId: r.id, label: r.label, postedId: r.lastPostedId || '', postedDate: r.lastPostedDate,
    amount: r.lastPosted, expected: r.usual ?? r.amount, forecastAmount, nextStep, reviewed: true, updatedAt };
}

// Earlier versions saved only a bill-level boolean. Bind that existing choice to the displayed
// charge once, then remove the boolean so a later charge cannot inherit a permanent dismissal.
export function migrateBillReviews(base, plan) {
  const bills = base.recurring.filter(r => r.unexplained && Object.hasOwn(plan.treatAsNewPrice || {}, r.id));
  if (!bills.length) return plan;
  const reviews = { ...plan.billReviews }, legacy = { ...plan.treatAsNewPrice };
  for (const r of bills) {
    reviews[billReviewKey(r)] ??= createBillReview(r, {
      forecastAmount: legacy[r.id] ? r.lastPosted : r.amount, nextStep: 'watch',
    }, `${base.today}T12:00:00Z`);
    delete legacy[r.id];
  }
  return { ...plan, billReviews: reviews, treatAsNewPrice: legacy };
}
