import { expect, it } from 'vitest';
import { spendingEvidenceDocuments } from '../src/engine/spending-evidence.js';

const categories = [
  { id: 'groceries', label: 'Groceries', budget: 816, spent: 343, average: 116.18 },
  { id: 'fun', label: 'Fun & other', budget: 247, spent: 46, average: 60 },
  { id: 'dining', label: 'Dining & takeout', budget: 200, spent: 88, average: 27.05 },
  { id: 'household', label: 'Household', budget: 176, spent: 836, average: 100 },
  { id: 'transit', label: 'Rides & transit', budget: 60, spent: 16, average: 20 },
];
function household(rows = categories) {
  return { today: '2026-09-13', allowances: rows.map(c => ({ id: c.id, label: c.label, monthly: c.budget })),
    spendingEvidence: { asOf: '2026-09-13', months: ['2026-07', '2026-08', '2026-09'], baselineMonths: ['2026-07', '2026-08'],
      categories: rows.map(c => ({ id: c.id, total: c.average * 10, count: 10, months: [
        { key: '2026-07', total: c.budget }, { key: '2026-08', total: c.budget }, { key: '2026-09', total: c.spent },
      ] })) } };
}
const goals = [{ label: 'Emergency fund', needed: 300, planned: 300, extraNeeded: 0, remainingNeeded: 0, targetDate: '2026-12-18' }];
const sc = { contribution: 300 }, after = { ...sc, cuts: { groceries: 116.18, dining: 27.05, transit: 12 } };
function expectBounded(docs) {
  expect(docs.length).toBeLessThanOrEqual(4);
  for (const e of docs) {
    expect(e.title.length).toBeLessThanOrEqual(120);
    expect(e.text.length).toBeLessThanOrEqual(700); // The deployed Python service's input_text contract.
    expect(e.text.length).toBeGreaterThan(0);
    expect(e.asOf).toBe('2026-09-13');
    expect(e.text).not.toMatch(/[<>\u0000-\u001f]/);
  }
}

it('fits the review contract with groceries both protected and unchecked, retaining its optional cut', () => {
  const h = household();
  const checked = spendingEvidenceDocuments(h, sc, h, sc, { groceries: true }, goals);
  const unchecked = spendingEvidenceDocuments(h, sc, h, after, {}, goals);
  expectBounded(checked); expectBounded(unchecked);
  expect(unchecked[2].text).toContain('Groceries');
  expect(unchecked[2].text).toContain('$116.18');
  expect(unchecked[2].text).toContain('Dining & takeout');
  expect(unchecked[2].text).toContain('Rides & transit');
  expect(unchecked[2].text).toContain('needs $300/month; planned $300/month');
  expect(unchecked[0].text).toContain('$660');
  expect(checked[2].text).not.toContain('Groceries');
});

it('stays within the contract for every checkbox combination', () => {
  const h = household();
  for (let bits = 0; bits < 32; bits++) {
    const protectedIds = Object.fromEntries(categories.map((c, i) => [c.id, !!(bits & (1 << i))]));
    const docs = spendingEvidenceDocuments(h, sc, h, after, protectedIds, goals,
      { amount: 660, deadline: '2026-12-18', requiredMonthly: 207.51, projected: 124.2, remaining: 535.8, extraMonthlyNeeded: 168.46 });
    expectBounded(docs);
    expect(docs[2].text).toContain('still short $535.8');
    expect(docs[2].text).toContain('Recovery NOT solved');
  }
});

it('keeps aggregate goal needs and marks omitted entries rather than cutting a money amount mid-sentence', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ ...categories[i % 5], id: `category-${i}`, label: `Long category ${i} `.padEnd(60, 'x') }));
  const h = household(rows);
  const manyGoals = Array.from({ length: 20 }, (_, i) => ({ ...goals[0], label: `Goal ${i} `.padEnd(60, 'x'), extraNeeded: 20, remainingNeeded: 10 }));
  const docs = spendingEvidenceDocuments(h, sc, h, { ...sc, cuts: Object.fromEntries(rows.map(r => [r.id, 20])) }, {}, manyGoals);
  expectBounded(docs);
  expect(docs[2].text).toContain('20 goals');
  expect(docs[2].text).toContain('extra needed $400/month');
  expect(docs[2].text).toContain('unassigned $200/month');
  expect(docs[2].text).toContain('omitted');
  for (const doc of docs) expect(doc.text).toMatch(/\.$/);
});
