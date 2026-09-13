import { expect, it } from 'vitest';
import { calculateChat } from '../api/_chat.js';
import { householdVersion } from '../api/_review.js';
import { emptyPlan } from '../src/engine/plan.js';
import { chatBrief } from '../src/chat/brief.js';
import { compoundPreviewRequest, questionPreview } from '../src/chat/grounding.js';
import { household as sample } from '../data/household.sample.js';
it('grounds the chat in recorded overspending without treating the savings capacity ceiling as spending money', () => {
  const base = { ...sample, activity: { asOf: sample.today, week: { spent: 1105 }, month: { income: 1800, spent: 2935 } } };
  const result = calculateChat(base, { consent: true, baseVersion: householdVersion(base), plan: emptyPlan(), tool: 'get_current_plan', args: {} });
  const brief = chatBrief(result);
  expect(brief).toContain('recorded spending $1,105.00');
  expect(brief).toContain('A funded goal does NOT mean this week is on budget');
  expect(brief).toContain('No maximum safe saving amount or spare spending allowance is provided');
  expect(brief).not.toContain('Supported monthly savings while preserving the cushion');
});
it('uses the supplied dated recovery calculation rather than inventing full months', () => {
  const result = calculateChat(sample, { consent: true, baseVersion: householdVersion(sample), plan: emptyPlan(), tool: 'get_current_plan', args: {} });
  const brief = chatBrief({ ...result, recoveryExample: { amount: 660, deadline: '2026-12-18', requiredMonthly: 207.51,
    monthlyReduction: 39.05, extraSavings: 0, projected: 124.2, remaining: 535.8 } });
  expect(brief).toContain('recover $124.20');
  expect(brief).toContain('$535.80 still unrecovered');
});
it('blocks explicit compound previews but permits a single subscription or by/to bill preview', () => {
  expect(compoundPreviewRequest('Add $20 on top of that increase')).toBe(true);
  expect(compoundPreviewRequest('Does the combined plan fit?')).toBe(true);
  expect(compoundPreviewRequest('Change internet to $25')).toBe(false);
  expect(compoundPreviewRequest('Preview a $20 subscription')).toBe(false);
});
it('precalculates clear subscription and by/to requests and leaves ambiguous dates or amounts alone', () => {
  const bills = [{ id: 'internet', label: 'Internet' }];
  expect(questionPreview('Preview a new $20 monthly subscription', bills)).toEqual({ tool: 'preview_monthly_cost', args: { amount: 20 } });
  expect(questionPreview('Internet increases by $25', bills)?.args).toMatchObject({ billId: 'internet', amount: 25, change: 'by' });
  expect(questionPreview('Change internet to $25, not by $25', bills)?.args).toMatchObject({ amount: 25, change: 'to' });
  expect(questionPreview('Reduce internet by $25', bills)?.args.amount).toBe(-25);
  expect(questionPreview('Add a $20 monthly subscription starting Oct 1', bills)).toBeNull();
  expect(questionPreview('Change internet by $20 or $25', bills)).toBeNull();
});
