// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BillDrawer from '../src/drawers/BillDrawer.jsx';
import BillReviewDrawer from '../src/drawers/BillReviewDrawer.jsx';
import { household as base } from '../data/household.sample.js';
import { emptyPlan, householdFor } from '../src/engine/plan.js';

let host, root, change, close, saveNote;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); change = vi.fn(); close = vi.fn(); saveNote = vi.fn(); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
const click = async text => act(() => [...host.querySelectorAll('button')].find(b => b.textContent === text).click());

it('does not remove a saved bill estimate until the named confirmation is accepted', async () => {
  const plan = { ...emptyPlan(), billChanges: { internet: { from: 65, to: 90, effective: '2026-10-01' } } };
  await act(() => root.render(<BillDrawer h={householdFor(base, plan)} plan={plan} billId="internet" cap={200}
    notes={{ 'bill-estimate:internet': 'Call again next month' }} saveNote={saveNote} change={change} onClose={close} />));
  await click('Remove saved estimate');
  expect(host.textContent).toContain('Remove the Internet estimate?'); expect(change).not.toHaveBeenCalled();
  await click('Keep estimate'); expect(change).not.toHaveBeenCalled();
  await click('Remove saved estimate'); await click('Remove estimate');
  expect(change.mock.calls[0][0].billChanges.internet).toBeNull();
  expect(saveNote).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
});

it('protects unsaved company-contact notes from accidental closing', async () => {
  await act(() => root.render(<BillReviewDrawer id="electric" h={base} plan={emptyPlan()} notes={{}} saveNote={saveNote} change={change} onClose={close} />));
  const note = host.querySelector('textarea');
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(note, 'Ask about the service fee');
    note.dispatchEvent(new Event('input', { bubbles: true }));
    host.querySelector('.drawer-bg').click();
  });
  expect(close).not.toHaveBeenCalled();
  await act(() => host.querySelector('[aria-label="Close"]').click());
  expect(host.textContent).toContain('Discard unsaved changes?');
  await click('Keep editing'); expect(note.value).toBe('Ask about the service fee');
  expect(saveNote).not.toHaveBeenCalled();
});
