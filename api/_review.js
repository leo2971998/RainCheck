import { createHash } from 'node:crypto';
import { emptyPlan, applyPatch } from '../src/engine/plan.js';
import { budgetImpact, readGoal, readSubscription, planningLimit } from '../src/engine/budget.js';
import { purchaseImpact } from '../src/engine/purchase-impact.js';
import { billReviewKey, NEXT_STEPS } from '../src/engine/bill-reviews.js';
import { validateFunding } from '../src/engine/goal-funding.js';

export const householdVersion = base => createHash('sha256').update(JSON.stringify(base)).digest('hex');
const fail = () => { throw new Error('This plan contains a value the review cannot use. Check its amounts and dates.'); };
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  if (Object.keys(value).some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) fail();
  return value;
}
function amount(value, max = 1000000) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) fail();
  return value;
}
function date(value, base, past = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString().slice(0, 10) !== value || value > planningLimit(base.today)
    || value < (past ? '2020-01-01' : base.today)) fail();
  return value;
}
const boolean = v => { if (typeof v !== 'boolean') fail(); return v; };
function map(value, read, keyPattern = /^[a-zA-Z0-9-]{1,100}$/) {
  const entries = Object.entries(object(value));
  if (entries.length > 50) fail();
  return Object.fromEntries(entries.map(([id, v]) => {
    if (!keyPattern.test(id)) fail();
    return [id, read(v, id)];
  }));
}

/** Accept decisions, never balances, forecasts, SQL, URLs or model instructions. */
export function readReviewPlan(raw, base) {
  object(raw);
  if (Object.keys(raw).some(k => !Object.hasOwn(emptyPlan(), k))) fail();
  const p = { ...emptyPlan(), ...raw };
  for (const k of ['contribution', 'goalTarget', 'cushion']) if (p[k] !== null) p[k] = amount(p[k]);
  if (p.goalDate !== null) p.goalDate = date(p.goalDate, base);
  p.goals = map(p.goals, value => value === null ? null : readGoal(value, base.today));
  if (p.goalFunding !== null) {
    p.goalFunding = map(p.goalFunding, v => {
      if (v === null) return null;
      object(v);
      if (Object.keys(v).some(k => !['monthly', 'saved', 'active'].includes(k))) fail();
      return { monthly: amount(v.monthly), saved: amount(v.saved), active: boolean(v.active) };
    });
    validateFunding(base, p);
    if (p.contribution !== null || p.goalDate !== null || p.goalTarget !== null || p.goalId !== null) fail();
  }
  if (p.goalId !== null && p.goalId !== 'emergency-fund' && !p.goals[p.goalId]) fail();
  p.subscriptions = map(p.subscriptions, (v, id) => {
    if (!/^sub-[a-z0-9-]+$/.test(id)) fail();
    return v === null ? null : { ...readSubscription(v, base.today), id };
  });
  p.adopted = map(p.adopted, (v, id) => {
    object(v);
    if (!base.allowances.some(a => a.id === v.categoryId) || !Number.isInteger(v.day) || v.day < 1 || v.day > 31
      || !Number.isInteger(v.everyMonths || 1) || (v.everyMonths || 1) < 1 || (v.everyMonths || 1) > 12) fail();
    return { id, label: 'Added commitment', amount: amount(v.amount), day: v.day, everyMonths: v.everyMonths || 1,
      categoryId: v.categoryId, monthlyShare: amount(v.monthlyShare ?? v.amount), ...(v.anchor ? { anchor: date(v.anchor, base, true) } : {}) };
  });
  const billIds = new Set([...base.recurring.map(r => r.id), ...Object.keys(p.subscriptions), ...Object.keys(p.adopted)]);
  const billMap = (value, read) => map(value, (v, id) => { if (!billIds.has(id)) fail(); return read(v); });
  p.billReviews = map(p.billReviews, (v, key) => {
    object(v);
    const fields = ['billId', 'label', 'postedId', 'postedDate', 'amount', 'expected', 'forecastAmount', 'nextStep', 'reviewed', 'updatedAt'];
    if (Object.keys(v).some(k => !fields.includes(k)) || !billIds.has(v.billId)
      || typeof v.postedId !== 'string' || !/^[a-zA-Z0-9-]{0,100}$/.test(v.postedId)
      || typeof v.updatedAt !== 'string' || v.updatedAt.length > 30 || !Number.isFinite(Date.parse(v.updatedAt))
      || !Object.hasOwn(NEXT_STEPS, v.nextStep)) fail();
    const record = { billId: v.billId, label: 'Reviewed bill', postedId: v.postedId,
      postedDate: date(v.postedDate, base, true), amount: amount(v.amount), expected: amount(v.expected),
      forecastAmount: amount(v.forecastAmount), nextStep: v.nextStep, reviewed: boolean(v.reviewed), updatedAt: v.updatedAt };
    if (record.postedDate > base.today || key !== billReviewKey({ id: record.billId,
      lastPostedId: record.postedId, lastPostedDate: record.postedDate, lastPosted: record.amount })) fail();
    return record;
  }, /^[a-zA-Z0-9_-]{1,240}$/);
  for (const k of ['cancelled', 'pendingCancel', 'treatAsNewPrice']) p[k] = billMap(p[k], boolean);
  p.whatIf = billMap(p.whatIf, amount);
  p.billChanges = billMap(p.billChanges, v => {
    object(v); return { to: amount(v.to), effective: date(v.effective, base, true), why: 'User-entered notice; not bank verified' };
  });
  p.paid = billMap(p.paid, v => { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) fail(); return v; });
  p.dismissed = map(p.dismissed, boolean);
  p.cuts = map(p.cuts, (v, id) => { const a = base.allowances.find(a => a.id === id); if (!a) fail(); return amount(v, a.monthly); });
  if (p.income !== null) {
    if (!Array.isArray(p.income) || p.income.length > 24) fail();
    p.income = p.income.map(i => {
      object(i);
      if (i.cadenceDays != null && (!Number.isInteger(i.cadenceDays) || i.cadenceDays < 1 || i.cadenceDays > 366)) fail();
      return { date: date(i.date, base), amount: amount(i.amount), ...(i.cadenceDays != null ? { cadenceDays: i.cadenceDays } : {}), label: 'Edited expected paycheck' };
    });
  }
  return p;
}

export function calculateReview(base, body) {
  object(body);
  const fields = ['consent', 'baseVersion', 'plan', 'patch', 'kind', 'question'];
  if (Object.hasOwn(body, 'optimize')) {
    if (body.optimize !== true || body.focus !== 'spending' || Object.keys(object(body.patch)).length) fail();
    fields.push('optimize');
  }
  if (Object.hasOwn(body, 'focus')) {
    if (body.focus !== 'spending' || body.kind !== 'plan') fail();
    fields.push('focus');
    if (Object.hasOwn(body, 'protectedCategories')) {
      readSpendingPreferences(base, body);
      fields.push('protectedCategories');
    }
  }
  if (Object.keys(body).length !== fields.length || Object.keys(body).some(k => !fields.includes(k)) || body.consent !== true
    || !['plan', 'goal', 'subscription', 'purchase'].includes(body.kind) || typeof body.question !== 'string'
    || !body.question.trim() || body.question.length > 500 || /[\u0000-\u001f<>]/.test(body.question)) fail();
  if (body.baseVersion !== householdVersion(base)) {
    const error = new Error('Your bank data or saved plans changed. Reload the workspace before asking for a review.'); error.status = 409; throw error;
  }
  const plan = readReviewPlan(body.plan, base);
  object(body.patch);
  if (body.kind === 'purchase') return purchaseImpact(base, plan, body.patch);
  const next = readReviewPlan(applyPatch(plan, body.patch).plan, base);
  if (body.focus === 'spending') {
    for (const id of Object.keys(readSpendingPreferences(base, body)))
      if ((next.cuts[id] || 0) > (plan.cuts[id] || 0)) fail();
  }
  // Both sides go through the same engine. No forecast supplied by the browser is used.
  const nextImpact = budgetImpact(base, next, {});
  return { ...budgetImpact(base, plan, {}), cushion: nextImpact.cushion, after: nextImpact.after };
}

export function readSpendingPreferences(base, body) {
  const ids = body.protectedCategories ?? [];
  if (!Array.isArray(ids) || ids.length > 50 || ids.some(id => typeof id !== 'string' || !base.allowances.some(a => a.id === id))) fail();
  return Object.fromEntries(ids.map(id => [id, true]));
}

export function reviewBrief(impact, body, evidence) {
  const cents = n => { const c = Math.round(n * 100); if (!Number.isSafeInteger(c)) fail(); return c; };
  const outcome = o => ({ lowCents: cents(o.low), cushionCents: cents(o.cushion), monthlyBillsCents: cents(o.monthlyBills),
    plannedPurchasesCents: cents(o.plannedPurchases),
    goalTargetCents: cents(o.target), goalProjectedCents: cents(o.projected), contributionCents: cents(o.contribution),
    goalDate: o.targetDate, contributionFits: o.fits, goalFeasible: o.feasible, checkedThrough: o.checkedThrough });
  return { version: 3, source: 'nessie-demo', asOf: impact.asOf, kind: body.kind, windowDays: impact.windowDays,
    cushionCents: cents(impact.cushion), before: outcome(impact.before), after: outcome(impact.after),
    question: body.question.trim(), evidence: evidence.map(e => ({ title: e.title, text: e.text, asOf: e.asOf })),
    ...(impact.week ? { purchaseWeek: { startsOn: impact.week.startsOn, endsOn: impact.week.endsOn,
      beforeLowCents: cents(impact.week.beforeLow), afterLowCents: cents(impact.week.afterLow) } } : {}) };
}
