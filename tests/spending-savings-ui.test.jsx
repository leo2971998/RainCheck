import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CashFlowPage from '../src/pages/CashFlowPage.jsx';
import { household as base } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import SavingsPlanner, { SavingsPreview } from '../src/drawers/SavingsPlanner.jsx';
import { savingsPreview } from '../src/engine/savings-plan.js';
import ReviewPanel, { ReviewAnswer } from '../src/components/ReviewPanel.jsx';
import { reviewBrief } from '../api/_review.js';
import WeeklyBudgetDrawer from '../src/drawers/WeeklyBudgetDrawer.jsx';
import { weeklyBudget } from '../src/engine/weekly-budget.js';

it('groups upcoming bills and every category into two panels with an optimize action', () => {
  const html = renderToStaticMarkup(<CashFlowPage base={base} h={base} sc={{ contribution: 300 }} plan={emptyPlan()}
    protectedIds={{ groceries: true }} setProtectedIds={() => {}} change={() => {}} open={() => {}} />);
  for (const text of ['Spending &amp; Savings', 'Expenses', 'Optimize budgets', 'Keep unchanged', 'Upcoming bills',
    'Recorded through', 'No money moves']) expect(html).toContain(text);
  expect(html.match(/class="spending-panel[" ]/g)).toHaveLength(2);
  expect(html.match(/class="category-progress"/g)).toHaveLength(base.allowances.length);
  expect(html).not.toContain('Adjust budget');
  expect(html).not.toContain('Income in October');
  expect(html).not.toContain('Learned from three months');
  expect(html).not.toContain('Everyday allowances');
});
it('shows a waiting state without editing controls before AI finishes', () => {
  const html = renderToStaticMarkup(<SavingsPlanner base={base} plan={emptyPlan()} protectedIds={{ groceries: true }} change={() => { throw new Error('must not run'); }} onClose={() => {}} />);
  for (const text of ['Optimizing your budgets', 'role="status"', 'No money moves']) expect(html).toContain(text);
  expect(html).not.toContain('<input');
  expect(html).not.toContain('Ask ZeroClaw');
  expect(html).not.toContain('Confirm budget &amp; savings changes');
});
it('shows AI reasoning and editable limits only after a completed analysis', () => {
  const optimization = { status: 'ready', data: { review: { status: 'complete', result: { summary: 'Dining has room for a small reduction.', observations: [], questions: [] } },
    optimization: { draft: { targets: Object.fromEntries(base.allowances.map(a => [a.id, a.monthly])), extras: {} } } } };
  const html = renderToStaticMarkup(<SavingsPlanner base={base} plan={emptyPlan()} optimization={optimization} protectedIds={{ groceries: true }} onClose={() => {}} />);
  for (const text of ['Dining has room for a small reduction.', 'Why these limits', 'Preview changes', '<input', 'Plan extra savings']) expect(html).toContain(text);
  expect(html).not.toContain('Ask ZeroClaw');
  const targetInputs = html.match(/<input[^>]+id="saving-[^>]+>/g);
  expect(targetInputs).toHaveLength(base.allowances.length);
  for (const input of targetInputs) {
    expect(input).not.toMatch(/readonly|disabled/i);
  }
  expect(html).toContain('kept unchanged by optimizer');
});
it('offers a retry without editable budgets when analysis fails or data changes', () => {
  for (const status of ['error', 'stale']) {
    const html = renderToStaticMarkup(<SavingsPlanner optimization={{ status }} onRetry={() => {}} onClose={() => {}} />);
    expect(html).toContain('Try again');
    expect(html).not.toContain('<input');
  }
});
it('lists unpaid upcoming bills, retaining cancellations that are only requested', () => {
  const h = { ...base, today: '2026-09-13', recurring: [
    { id: 'settled', label: 'Already paid service', amount: 25, day: 15 },
    { id: 'ended', label: 'Ended service', amount: 30, day: 15 },
    { id: 'pending', label: 'Awaiting cancellation', amount: 40, day: 15 },
  ] };
  const html = renderToStaticMarkup(<CashFlowPage base={h} h={h} sc={{ paid: { settled: '2026-09' }, cancelled: { ended: true }, pendingCancel: { pending: true } }}
    plan={emptyPlan()} setProtectedIds={() => {}} open={() => {}} />);
  expect(html).toContain('Awaiting cancellation');
  expect(html).toContain('Sep 15');
  expect(html).not.toContain('Already paid service');
  expect(html).not.toContain('Ended service');
});
it('keeps a savings AI review concise instead of duplicating the forecast metrics', () => {
  const preview = savingsPreview(base, emptyPlan(), { targets: {}, extras: {} });
  const facts = reviewBrief(preview.impact, { kind: 'plan', question: 'Find savings' }, []);
  const review = { facts, result: { summary: 'Review dining before changing necessities.', observations: [], questions: [] } };
  const html = renderToStaticMarkup(<ReviewAnswer review={review} compact />);
  expect(html).toContain('Review dining before changing necessities.');
  expect(html).not.toContain('Lowest checking');
  expect(html).not.toContain('Goal projection');
  const form = renderToStaticMarkup(<ReviewPanel focus="spending" variant="savings" plan={emptyPlan()} />);
  expect(form).toContain('ZeroClaw');
});
it('does not enable confirmation for an unaffordable extra savings proposal', () => {
  const p = savingsPreview(base, emptyPlan(), { targets: {}, extras: {} });
  const html = renderToStaticMarkup(<SavingsPreview preview={{ ...p, hasChanges: true, canApply: false }} onConfirm={() => { throw new Error('must not run'); }} />);
  expect(html).toMatch(/<button[^>]+disabled=""[^>]*>Confirm budget &amp; savings changes/);
});
it('keeps upcoming income accessible in weekly details after replacing Cash flow', () => {
  const h = { ...base, income: [{ date: '2026-10-02', amount: 1700 }] };
  const html = renderToStaticMarkup(<WeeklyBudgetDrawer h={h} weekly={weeklyBudget(h, {})} open={() => {}} onClose={() => {}} />);
  expect(html).toContain('Next expected income');
  expect(html).toContain('Oct 2');
  expect(html).toContain('$1,700');
  expect(html).toContain('Not received yet');
});
