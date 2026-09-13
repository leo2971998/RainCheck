import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { household, transactions } from '../data/household.sample.js';
import App from '../src/App.jsx';

vi.mock('../src/hooks/useHousehold.js', () => ({ useHousehold: () => ({
  household, transactions, source: 'nessie', loading: false, purchasesAvailable: true,
}) }));
afterEach(() => vi.unstubAllGlobals());

it('has one global chat entry and a plain sample-data disclosure, not provider branding', () => {
  vi.stubGlobal('window', { location: { search: '' } });
  const html = renderToStaticMarkup(<App />);
  expect(html.match(/Ask RainCheck/g)).toHaveLength(1);
  expect(html).not.toContain('aria-label="Chat"');
  expect(html).toContain('class="chat-launcher"');
  expect(html).not.toContain('Nessie sandbox');
  expect(html).toContain('Sample data');
  expect(html).toContain('No real bank account is connected');
});
