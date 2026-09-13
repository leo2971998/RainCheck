import { budgetMoney as money } from './BudgetImpact.jsx';

// History stays recorded; the forecast column uses the same selected plan as the headline.
const shortMonth = key => new Date(key + '-01T12:00:00').toLocaleDateString('en-US', { month: 'short' });

export default function MonthsCompare({ evidence, forecastMonth, outlook }) {
  const months = evidence?.months ?? [];
  const history = (evidence?.categories ?? []).filter(c => c.total > 0);
  const everyday = outlook?.rows.filter(r => r.kind === 'everyday') ?? [];
  const categories = history.map(c => ({ ...c,
    expected: outlook ? everyday.find(r => r.id === c.id)?.expected ?? 0 : c.monthly }));
  for (const r of everyday) if (!categories.some(c => c.id === r.id)) categories.push({ ...r, months: [] });
  if (!outlook && (!months.length || !categories.length)) return null;

  const totalFor = key => categories.reduce((sum, c) => sum + (c.months.find(m => m.key === key)?.total || 0), 0);
  const forecastTotal = Math.round(categories.reduce((sum, c) => sum + c.expected, 0) * 100) / 100;
  const bills = outlook?.rows.filter(r => r.kind === 'bill') ?? [];
  const missingHistory = () => months.map(m => <td key={m.key} className="r mc-dim" title="Not included in this history">—</td>);

  return (
    <section className="card months-compare">
      <div className="hd">
        <div>
          <h2>Every month on record</h2>
        </div>
      </div>

      <div className="scroll-x" role="region" aria-label="Monthly spending comparison" tabIndex={0}>
        <table className="mc-table">
          <thead>
            <tr>
              <th>Category</th>
              {months.map(m => <th key={m.key} className="r">{shortMonth(m.key)}{m.partial && <small> partial</small>}</th>)}
              <th className="r mc-fc">{shortMonth(forecastMonth)}<small>{outlook?.partial ? ' remaining' : ' forecast'}</small></th>
            </tr>
          </thead>
          <tbody>
            {categories.map(c => (
              <tr key={c.id}>
                <td>{c.label}{c.provisional && <small className="fine"> · limited history</small>}</td>
                {months.map(m => {
                  const hit = c.months.find(x => x.key === m.key);
                  return <td key={m.key} className={'r num' + (m.partial ? ' mc-dim' : '')}>{hit ? money(hit.total) : '—'}</td>;
                })}
                <td className="r num mc-fc"><b>{money(c.expected)}</b></td>
              </tr>
            ))}
            <tr>
              <td><b>Everyday spending subtotal</b></td>
              {months.map(m => <td key={m.key} className={'r num' + (m.partial ? ' mc-dim' : '')}><b>{money(totalFor(m.key))}</b></td>)}
              <td className="r num mc-fc"><b>{money(forecastTotal)}</b></td>
            </tr>
            {outlook && <>
              {(bills.length ? bills : [{ id: 'no-bills', label: 'Scheduled bills', expected: 0 }]).map(b => <tr key={b.id}>
                <td>{b.label}</td>{missingHistory()}
                <td className="r num mc-fc"><b>{money(b.expected)}</b></td>
              </tr>)}
              <tr>
                <td title="Only costs beyond existing category budgets are added here.">Planned purchases (extra)</td>{missingHistory()}
                <td className="r num mc-fc"><b>{money(outlook.extra)}</b></td>
              </tr>
              <tr className="mc-total">
                <td><b>Total expected spending</b></td>{missingHistory()}
                <td className="r num mc-fc"><b>{money(outlook.spending)}</b></td>
              </tr>
            </>}
          </tbody>
        </table>
      </div>

      {evidence?.oneOffs?.length > 0 && (
        <p className="fine">
          Left out of the estimate: {evidence.oneOffs.map(o => `${o.label} ${money(o.amount)}`).join(', ')} —
          one-time event purchases, which stay in the month they happened.
        </p>
      )}
    </section>
  );
}
