import { budgetMoney as money } from './BudgetImpact.jsx';

/**
 * Every recorded month, side by side, against the month being forecast.
 *
 * The estimate for a category is the middle of its recorded monthly totals. Until now the page
 * asserted that in a paragraph; this shows the totals it was talking about, so a reader can check
 * the claim instead of taking it. A month the records only partly cover is marked and excluded
 * from the estimate, because dividing an unfinished month as though it were complete is how a
 * forecast quietly reads low.
 *
 * Nothing here is computed: `evidence.categories[].months` is what the baseline was built from.
 */
const shortMonth = key => new Date(key + '-01T12:00:00').toLocaleDateString('en-US', { month: 'short' });

export default function MonthsCompare({ evidence, forecastMonth }) {
  const months = evidence?.months ?? [];
  const categories = (evidence?.categories ?? []).filter(c => c.total > 0);
  if (!months.length || !categories.length) return null;

  const totalFor = key => categories.reduce((sum, c) => sum + (c.months.find(m => m.key === key)?.total || 0), 0);
  const forecastTotal = categories.reduce((sum, c) => sum + c.monthly, 0);

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
              <th className="r mc-fc">{shortMonth(forecastMonth)}<small> forecast</small></th>
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
                <td className="r num mc-fc"><b>{money(c.monthly)}</b></td>
              </tr>
            ))}
            <tr className="mc-total">
              <td><b>Total</b></td>
              {months.map(m => <td key={m.key} className={'r num' + (m.partial ? ' mc-dim' : '')}><b>{money(totalFor(m.key))}</b></td>)}
              <td className="r num mc-fc"><b>{money(forecastTotal)}</b></td>
            </tr>
          </tbody>
        </table>
      </div>

      {evidence.oneOffs?.length > 0 && (
        <p className="fine">
          Left out of the estimate: {evidence.oneOffs.map(o => `${o.label} ${money(o.amount)}`).join(', ')} —
          one-time event purchases, which stay in the month they happened.
        </p>
      )}
    </section>
  );
}
