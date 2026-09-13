import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useTheme } from '../src/hooks/useTheme.js';

function Preference() {
  const theme = useTheme();
  return <div data-theme={theme.mode}>{theme.MODES.join(',')}</div>;
}
afterEach(() => vi.unstubAllGlobals());

it.each(['auto', null, 'invalid'])('uses Light for a missing or retired preference (%s)', value => {
  vi.stubGlobal('localStorage', { getItem: () => value });
  expect(renderToStaticMarkup(<Preference />)).toBe('<div data-theme="light">light,dark</div>');
});
it.each(['light', 'dark'])('preserves an explicit %s preference', value => {
  vi.stubGlobal('localStorage', { getItem: () => value });
  expect(renderToStaticMarkup(<Preference />)).toBe(`<div data-theme="${value}">light,dark</div>`);
});
it('defaults to Light when storage is unavailable', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Blocked'); } });
  expect(renderToStaticMarkup(<Preference />)).toContain('data-theme="light"');
});
