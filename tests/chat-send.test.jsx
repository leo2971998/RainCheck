// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ status: 'disconnected', callbacks: {}, startSession: vi.fn(), endSession: vi.fn(), sendUserMessage: vi.fn(), sendContextualUpdate: vi.fn() }));
vi.mock('@elevenlabs/react', () => ({ ConversationProvider: ({ children }) => children,
  useConversation: options => { sdk.callbacks = options; return sdk; } }));
vi.mock('streamdown', () => ({ Streamdown: ({ children }) => children }));
vi.mock('../src/chat/brief.js', () => ({ chatBrief: () => 'Current calculated facts' }));
import ChatPage from '../src/pages/ChatPage.jsx';
let root, host, fetcher;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(async () => {
  vi.clearAllMocks(); sdk.status = 'disconnected'; sdk.startSession.mockResolvedValue('id');
  fetcher = vi.fn(async (url, options) => ({ ok: true, json: async () => url === '/api/chat-context'
    ? { impact: { after: { fits: true, feasible: true, low: 500, projected: 2000 } }, bills: [] }
    : options?.method === 'POST' ? { signedUrl: 'wss://test.invalid' } : { available: true } }));
  vi.stubGlobal('fetch', fetcher);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(() => root.render(<ChatPage baseVersion="test" plan={{}} visible />));
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function type(text) { await act(() => {
  const el = host.querySelector('textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}); }
const clickSend = () => act(() => host.querySelector('[aria-label="Send message"]').click());
async function connected() { await act(() => {
  sdk.status = 'connected'; sdk.callbacks.onConnect();
  sdk.callbacks.onMessage({ source: 'ai', message: 'Hello!', event_id: 1 });
}); }
it('opening chat does not start a paid session, but sending the first question connects and sends once', async () => {
  expect(host.textContent).not.toContain('Start chatting');
  expect(sdk.startSession).not.toHaveBeenCalled();
  await type('How does my plan look?'); await clickSend(); await clickSend();
  expect(sdk.startSession).toHaveBeenCalledTimes(1);
  expect(sdk.sendUserMessage).not.toHaveBeenCalled();
  await connected();
  expect(sdk.sendUserMessage).toHaveBeenCalledExactlyOnceWith('How does my plan look?');
  expect(host.querySelector('textarea').value).toBe('');
});
it('a suggestion starts and sends without a second click', async () => {
  await act(() => host.querySelector('.chat-examples button').click()); await connected();
  expect(sdk.sendUserMessage).toHaveBeenCalledExactlyOnceWith('How does my current plan look?');
});
it('keeps an unsent question after a rejected connection and allows retry', async () => {
  sdk.startSession.mockRejectedValueOnce(new Error('Connection unavailable'));
  await type('Can I recover the overspend?'); await clickSend();
  expect(host.querySelector('textarea').value).toBe('Can I recover the overspend?');
  expect(sdk.sendUserMessage).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await clickSend(); await connected();
  expect(sdk.sendUserMessage).toHaveBeenCalledExactlyOnceWith('Can I recover the overspend?');
});
it('ending during connection never sends the pending question later', async () => {
  let resolve; sdk.startSession.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  await type('First question'); await clickSend();
  await act(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'End chat').click());
  await act(async () => { resolve('id'); }); await connected();
  expect(sdk.sendUserMessage).not.toHaveBeenCalled();
  expect(host.querySelector('textarea').value).toBe('First question');
});
it('does not send an unsupported combined scenario to the model or pretend it fits', async () => {
  await type('Add a subscription on top of that bill change.'); await clickSend();
  expect(sdk.startSession).not.toHaveBeenCalled();
  expect(sdk.sendUserMessage).not.toHaveBeenCalled();
  expect(host.textContent).toContain('That combined plan has not been calculated');
});
it('answers a transfer request with an application boundary, never a fake transfer screen', async () => {
  await type('Please apply that change and transfer $100 to savings.'); await clickSend();
  expect(sdk.startSession).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Use your bank for a real transfer');
  expect(host.textContent).not.toContain('app’s transfer');
});
it('keeps waiting for the answer when a streamed greeting is followed by its final duplicate', async () => {
  await type('How is my plan?'); await clickSend();
  await act(() => {
    sdk.status = 'connected'; sdk.callbacks.onConnect();
    sdk.callbacks.onAgentChatResponsePart({ type: 'delta', text: 'Hello!', event_id: 1 });
    sdk.callbacks.onAgentChatResponsePart({ type: 'stop', text: '', event_id: 1 });
  });
  expect(sdk.sendUserMessage).toHaveBeenCalledTimes(1);
  await act(() => sdk.callbacks.onMessage({ source: 'ai', message: 'Hello!', event_id: 1 }));
  await type('Next question'); expect(host.querySelector('[aria-label="Send message"]').disabled).toBe(true);
  await act(() => sdk.callbacks.onMessage({ source: 'ai', message: 'Your week needs review.', event_id: 2 }));
  expect(host.querySelector('[aria-label="Send message"]').disabled).toBe(false);
});
