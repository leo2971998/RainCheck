import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TransactionsPage from '../src/pages/TransactionsPage.jsx';

const transactions = [
  { date: '2026-09-06', d: 'Sep 6', what: 'Reliant Energy', amt: -196, cat: 'Electric', k: 'rec', note: 'Higher than usual.', review: true },
  { date: '2026-09-05', d: 'Sep 5', what: 'Savings transfer', amt: -300, cat: 'Transfer', k: 'tr', note: 'Your own savings account.' },
  { date: '2026-09-04', d: 'Sep 4', what: 'Coffee Spot', amt: -8, cat: 'Dining', k: 'ev', note: '4 charges this month.' },
  { id: 'purchase:appliance', date: '2026-09-08', d: 'Sep 8', what: 'Appliance shop', amt: -742, cat: 'Household', k: 'ev' },
];

it('counts only actionable transaction notes and links their resolution to Alerts', () => {
  const unusual = [{ ...transactions[3], unusual: { note: 'This charge is outside your usual spending.' } }];
  const html = renderToStaticMarkup(<TransactionsPage transactions={transactions} unusual={unusual} allowances={[]} corrections={{}} setCorrections={() => {}} open={() => {}} />);

  expect(html).toContain('1 needs your review');
  expect(html).toContain('Resolve in Alerts');
  expect(html.match(/<i class="rev">/g)).toHaveLength(1);
  expect(html).toContain('Your own savings account.');
  expect(html).toContain('4 charges this month.');
});
