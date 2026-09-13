/**
 * Charges that look wrong, as a bank would mean it.
 *
 * A recurring bill that went up is not this. A utility costing more is a bill doing what bills do;
 * it changes the forecast, and it belongs to Recurring, where the answer is to ask the provider.
 * Putting it behind a warning triangle borrowed the language of fraud for an ordinary price rise.
 *
 * What belongs here is a charge that does not fit the household: far larger than anything they
 * normally spend, or from a merchant with no history at all. The question is "was this you?", and
 * only the person can answer it.
 *
 * The large-charge threshold uses everyday spending history; first-time merchants also have a
 * minimum amount. Neither rule proves fraud, and recurring bills do not set this threshold.
 */

const MIN_HISTORY = 20;          // below this there is no pattern to be outside of
const OVER_USUAL = 3;            // multiples of the everyday 95th percentile
const FLOOR = 150;               // never question a small charge, however unusual the merchant

const percentile = (sorted, q) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0;

/**
 * What "normal" means for this household, measured from its own everyday spending.
 * Bills and transfers are excluded: rent is large every month and proves nothing about a card charge.
 */
export function spendingShape(transactions = []) {
  const charges = transactions.filter(t => t.k === 'ev' && Number.isFinite(t.amt) && t.amt < 0);
  const everyday = charges.map(t => -t.amt).sort((a, b) => a - b);
  const seen = new Map();
  for (const t of charges) {
    if (!t.what) continue;
    seen.set(t.what, (seen.get(t.what) || 0) + 1);
  }
  return {
    count: everyday.length,
    usual: percentile(everyday, 0.95),
    largest: everyday.at(-1) ?? 0,
    threshold: Math.max(FLOOR, Math.round(percentile(everyday, 0.95) * OVER_USUAL)),
    merchants: seen,
  };
}

/**
 * Why a charge was questioned, in the words the row will use — or null when nothing is wrong.
 * A thin history returns null throughout: with too few records, "unusual" means "unfamiliar to us",
 * which is not the same thing and should not be presented as a warning.
 */
export function unusualReason(t, shape) {
  if (!t || t.k !== 'ev' || !Number.isFinite(t.amt) || t.amt >= 0 || shape.count < MIN_HISTORY) return null;
  const amount = Math.abs(t.amt);
  const timesSeen = shape.merchants.get(t.what) || 0;
  if (amount >= shape.threshold) {
    return { kind: 'amount', amount,
      note: `${fmt(amount)} is far above your usual spending. Most charges are under ${fmt(shape.usual)}.` };
  }
  if (timesSeen <= 1 && amount >= FLOOR) {
    return { kind: 'merchant', amount,
      note: `First charge from this merchant, for ${fmt(amount)}. Nothing else in your history matches it.` };
  }
  return null;
}

const fmt = n => '$' + Math.round(n).toLocaleString('en-US');

/** The charges still waiting on an answer, newest first. */
export function unusualCharges(transactions = [], plan = {}) {
  const shape = spendingShape(transactions);
  return transactions
    .map(t => ({ t, reason: unusualReason(t, shape) }))
    .filter(({ t, reason }) => reason && chargeAnswer(t, plan)?.answer !== 'mine')
    .map(({ t, reason }) => ({ ...t, unusual: reason }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

/** Stable across reloads: the bank's own record id where there is one, the row's shape otherwise. */
export const chargeKey = t => t?.id || `${t?.date || t?.d}|${t?.what}|${t?.amt}`;

/** Has this charge already been answered? */
export const chargeAnswer = (t, plan = {}) => plan.chargeAnswers?.[chargeKey(t)] ?? null;

/** Record the person's answer. `mine` clears it; `unknown` keeps it visible as something to chase. */
export function answerChargePatch(t, answer, at = new Date().toISOString()) {
  if (!['mine', 'unknown'].includes(answer)) throw new Error('Choose whether you recognise this charge.');
  return { chargeAnswers: { [chargeKey(t)]: { answer, at, label: t.what, amount: Math.abs(t.amt), date: t.d } } };
}
