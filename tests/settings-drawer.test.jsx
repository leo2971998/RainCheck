import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SettingsDrawer from '../src/drawers/SettingsDrawer.jsx';

it('keeps reversible rain scenarios inside Settings', () => {
  const html = renderToStaticMarkup(<SettingsDrawer hasDecisions={false} onClose={() => {}} />);
  expect(html).toContain('aria-label="Settings"');
  expect(html).toContain('Start rain demo');
  expect(html).toMatch(/disabled=""[^>]*>Reset choices/);
  expect(html).not.toContain('Clear choices</button>');
});
it('offers to clear only the rain scenario while keeping other choices', () => {
  const html = renderToStaticMarkup(<SettingsDrawer demoCost={{ amount: 25 }} hasDecisions onClose={() => {}} />);
  expect(html).toContain('Clear rain demo');
  expect(html).not.toContain('Start rain demo');
});
