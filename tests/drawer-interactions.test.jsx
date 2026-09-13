// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Drawer, { DrawerHeader } from '../src/components/Drawer.jsx';

let root, host, close;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); close = vi.fn(); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
const click = async el => act(() => el.click());
const escape = async () => act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
async function render(props = {}) {
  await act(() => root.render(<Drawer label="Edit goal" onClose={close} {...props}>
    <DrawerHeader title="Edit goal" onClose={close} />
    <form><label>Goal name<input defaultValue="Trip" /></label><button type="submit">Save goal</button></form>
  </Drawer>));
}

it('does not close when a selection drag ends outside the panel, or the background is clicked', async () => {
  await render();
  const input = host.querySelector('input'), backdrop = host.querySelector('.drawer-bg');
  await act(() => {
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    backdrop.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    backdrop.click();
  });
  expect(close).not.toHaveBeenCalled();
  await click(backdrop);
  expect(close).not.toHaveBeenCalled();
});

it('asks before discarding form changes, and keeps the draft when editing continues', async () => {
  await render({ protectChanges: true });
  const input = host.querySelector('input');
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Family trip');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click(host.querySelector('[aria-label="Close"]'));
  expect(close).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Discard unsaved changes?');
  await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Keep editing'));
  expect(input.value).toBe('Family trip');
  expect(close).not.toHaveBeenCalled();
  await escape();
  await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Discard changes'));
  expect(close).toHaveBeenCalledTimes(1);
});

it('allows explicit close on an untouched form, but not while a save is pending', async () => {
  await render({ protectChanges: true });
  await escape();
  expect(close).toHaveBeenCalledTimes(1);
  close.mockClear();
  await render({ busy: true });
  await escape();
  await click(host.querySelector('[aria-label="Close"]'));
  expect(close).not.toHaveBeenCalled();
});

it('restores focus to the opener and releases scrolling when closed', async () => {
  const opener = document.createElement('button'); document.body.append(opener); opener.focus();
  document.body.style.overflow = 'auto';
  await render();
  expect(document.body.style.overflow).toBe('hidden');
  await act(() => root.render(null));
  expect(document.activeElement).toBe(opener);
  expect(document.body.style.overflow).toBe('auto');
  opener.remove();
});

it('keeps keyboard focus in the top confirmation instead of closing the drawer underneath', async () => {
  const cancel = vi.fn();
  await act(() => root.render(<><Drawer label="Options" onClose={close}><button>Compare</button></Drawer>
    <Drawer variant="modal" label="Apply this plan?" onClose={cancel}><button>Apply</button><button data-initial-focus>Cancel</button></Drawer></>));
  expect(document.activeElement.textContent).toBe('Cancel');
  await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement.textContent).toBe('Apply');
  await escape();
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
});
