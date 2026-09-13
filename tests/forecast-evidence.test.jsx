import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import snapshot from '../data/nessie-snapshot.json';
import { household as sample } from '../data/household.sample.js';
import { buildHousehold } from '../src/engine/household.js';
import { simulate } from '../src/engine/forecast.js';
import { spendingBaseline } from '../src/engine/spending-baseline.js';
import { checkingBreakdown, forecastEvidenceDocuments } from '../src/engine/forecast-explanation.js';
import { ForecastReason, ForecastDate } from '../src/components/ForecastEvidence.jsx';
import { Outlook } from '../src/components/Weather.jsx';
import { calculateChat } from '../api/_chat.js';
import { householdVersion } from '../api/_review.js';
import { emptyPlan } from '../src/engine/plan.js';
import { chatBrief } from '../src/chat/brief.js';
import { createHandler } from '../api/review.js';

it('keeps the existing three-month baseline and attaches its actual recorded evidence', () => {
  const h = buildHousehold(snapshot, sample.today);
  expect(h.allowances).toEqual(sample.allowances);
  expect(h.spendingEvidence).toMatchObject({ lookbackDays: 90, divisorMonths: 2, from: '2026-07-02', through: '2026-09-27' });
  const groceries = h.spendingEvidence.categories.find(c => c.id === 'groceries');
  expect(groceries.monthly).toBe(700);
  // The retained sample has equal months; varying-month behavior has separate unit coverage.
  expect(groceries.months.map(m => m.total)).toEqual([700, 700, 700]);
  expect(groceries.count).toBeGreaterThan(0);
  expect(groceries.months.reduce((s, m) => s + m.total, 0)).toBe(groceries.total);
  expect(h.spendingEvidence.months.at(-1)).toMatchObject({ key: '2026-09', partial: true });
});

it('does not add future records, pending charges, other accounts or bills to everyday spending', () => {
  const before = spendingBaseline(snapshot, sample.today);
  const first = snapshot.purchases[0];
  const changed = structuredClone(snapshot);
  changed.purchases.push(
    { ...first, _id: 'future', purchase_date: '2026-10-02', amount: 99999 },
    { ...first, _id: 'pending', status: 'pending', amount: 99999 },
    { ...first, _id: 'foreign', payer_id: 'another-account', amount: 99999 },
  );
  expect(spendingBaseline(changed, sample.today)).toEqual(before);
  expect(before.evidence.categories.some(c => /rent|internet|electric/i.test(c.label))).toBe(false);
});

it('does not describe sparse history as three complete months', () => {
  const few = { ...snapshot, purchases: snapshot.purchases.slice(0, 1), withdrawals: [] };
  const { evidence } = spendingBaseline(few, sample.today);
  expect(evidence.divisorMonths).toBe(1);
  expect(evidence.months.length).toBeLessThan(3);
  expect(evidence.coverageNote).toMatch(/not proof/);
});

it('shows the same dollars and dated events that produce the lowest balance', () => {
  const sim = simulate(sample, { contribution: 300 });
  const rows = checkingBreakdown(sample, sim);
  expect(rows.reduce((s, r) => s + r.amount, 0)).toBeCloseTo(sim.low.balance, 2);
  expect(sim.low.key).toBe('2026-10-15');
  expect(sim.low.balance).toBe(200);
  const html = renderToStaticMarkup(<ForecastReason h={sample} sim={sim} expanded />);
  expect(html).toContain('Oct 15');
  expect(html).toContain('Oct 16');
  expect(html).toContain('Phone');
  expect(html).toContain('Gym');
  expect(html).toContain('Estimated everyday spending');
  expect(html).toContain('Monthly goal savings');
});

it('keeps aggregate evidence bounded and does not share account IDs or personal notes with AI', () => {
  const h = buildHousehold(snapshot, sample.today);
  h.notes = 'PRIVATE CUSTOMER NOTE';
  const docs = forecastEvidenceDocuments(h, simulate(h, { contribution: 300 }));
  expect(docs).toHaveLength(2);
  expect(docs.every(d => d.text.length <= 700)).toBe(true);
  const text = JSON.stringify(docs);
  expect(text).toContain('90-day');
  expect(text).toContain('not a learned weekly pattern');
  expect(text).toContain('200');
  expect(text).not.toContain('PRIVATE CUSTOMER NOTE');
  expect(text).not.toContain(h.accountIds.checking);
});

it('labels the fixed forecast start explicitly instead of pretending it is this week', () => {
  const sim = simulate(sample, { contribution: 300 });
  const html = renderToStaticMarkup(<><ForecastDate h={sample} sim={sim} /><Outlook h={sample} sim={sim} /></>);
  expect(html).toContain('Sep 28, 2026');
  expect(html).toContain('Sep 28 – Oct 4');
  expect(html).toContain('Oct 5 – Oct 11');
  expect(html).not.toContain('This week');
  expect(html).not.toContain('Near target');
  expect(html).toContain('Checking buffer');
});

it('gives the chat the saved-plan baseline separately from a bill preview', () => {
  const h = buildHousehold(snapshot, sample.today);
  const result = calculateChat(h, { consent: true, baseVersion: householdVersion(h), plan: emptyPlan(),
    tool: 'preview_bill', args: { billId: 'internet', amount: 25, change: 'by' } });
  expect(result.forecastEvidence).toHaveLength(2);
  expect(result.forecastEvidence[1].text).toContain('SAVED PLAN, not a preview');
  expect(chatBrief(result)).toContain('not a learned weekly pattern');
  expect(chatBrief(result)).toContain('Isolated preview:');
  expect(result.impact.after.low).toBe(199.19);
});

it('sends calculated history to ZeroClaw even when the optional search index is unavailable', async () => {
  const h = buildHousehold(snapshot, sample.today);
  let received;
  const handler = createHandler({ env: { RAINCHECK_AI_LOCAL: '1' }, load: async () => ({ base: h, snapshot }),
    retrieve: async () => ({ status: 'unavailable', evidence: [] }),
    review: async brief => { received = brief; return { status: 'complete', facts: brief }; } });
  const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '127.0.0.1:5176', origin: 'http://127.0.0.1:5176', 'content-type': 'application/json' },
    body: { consent: true, baseVersion: householdVersion(h), plan: emptyPlan(), patch: {}, kind: 'plan', question: 'Why does checking dip?' } }, res);
  expect(res.statusCode).toBe(200);
  expect(received.evidence).toHaveLength(2);
  expect(received.evidence[0].text).toContain('Baseline $1500/month');
  expect(res.body.retrieval.calculatedCount).toBe(2);
  expect(received.before.lowCents).toBe(Math.round(res.body.impact.before.low * 100));
});
