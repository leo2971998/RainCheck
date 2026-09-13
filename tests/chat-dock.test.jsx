import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import ChatDock, { ChatLauncher } from '../src/components/ChatDock.jsx';

it('keeps the conversation mounted while the dock is minimized', () => {
  const html = renderToStaticMarkup(<ChatDock open={false} onClose={() => {}}><p>Existing conversation</p></ChatDock>);
  expect(html).toContain('Existing conversation');
  expect(html).toContain('<dialog');
  expect(html).not.toContain(' open=""');
  expect(html).toContain('aria-label="RainCheck chat"');
});

it('offers a labeled floating launcher tied to the chat panel', () => {
  const html = renderToStaticMarkup(<ChatLauncher onOpen={() => {}} />);
  expect(html).toContain('aria-label="Open RainCheck chat"');
  expect(html).toContain('aria-controls="raincheck-chat-dock"');
  expect(html).toContain('type="button"');
});
