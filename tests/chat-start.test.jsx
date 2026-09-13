import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('@elevenlabs/react', () => ({
  ConversationProvider: ({ children }) => children,
  useConversation: () => ({ status: 'disconnected' }),
}));
vi.mock('streamdown', () => ({ Streamdown: ({ children }) => children }));
import ChatPage from '../src/pages/ChatPage.jsx';

it('offers one explicit start action instead of a separate cloud-chat checkbox', () => {
  const html = renderToStaticMarkup(<ChatPage baseVersion="test-version" plan={{}} visible />);
  expect(html).toContain('Start chatting');
  expect(html).not.toContain('type="checkbox"');
  expect(html).not.toContain('Allow ElevenLabs cloud chat');
});

it('credits ElevenLabs Agents and keeps sharing and retention details available', () => {
  const html = renderToStaticMarkup(<ChatPage baseVersion="test-version" plan={{}} visible />);
  expect(html).toContain('Powered by ElevenLabs Agents');
  expect(html).toContain('What is shared?');
  expect(html).toContain('retain conversation transcripts');
  expect(html).toContain('never uses your microphone');
});
