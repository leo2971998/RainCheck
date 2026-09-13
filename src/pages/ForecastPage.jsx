import { useMemo, useState } from 'react';
import { prettyIso } from '../components/ui.jsx';
import { budgetMoney as money } from '../components/BudgetImpact.jsx';
import { monthlyOutlook, nextForecastMonth } from '../engine/monthly-outlook.js';
import MonthsCompare from '../components/MonthsCompare.jsx';

const monthName = month => new Date(month + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export default function ForecastPage({ h, sc }) {
  const [selected, setSelected] = useState(null);
  const choices = [0, 1, 2, 3].map(i => nextForecastMonth(h.today, i));
  const month = choices.includes(selected) ? selected : choices[1];
  const out = useMemo(() => monthlyOutlook(h, sc, month), [h, sc, month]);
  const evidence = h.spendingEvidence;
  return <div className="monthly-forecast">
    <div className="topbar"><div><h1>Forecast</h1><div className="sub">Compare recorded spending with the selected month’s estimate.</div></div>
      <label className="month-picker">Month<select value={month} onChange={e => setSelected(e.target.value)}>{choices.map(m => <option key={m} value={m}>{monthName(m)}{m === h.today.slice(0, 7) ? ' · remaining days' : ''}</option>)}</select></label>
    </div>
    <p className="month-asof">Plan dated {prettyIso(h.today)} · {out.partial ? `Remaining costs from ${prettyIso(out.start)}` : `Planning for ${monthName(month)}`}</p>
    <section className="month-summary" aria-label="Monthly spending estimate">
      <div><span>{out.partial ? 'Still expected this month' : 'Expected spending'}</span><strong className="num">{money(out.spending)}</strong><p>Estimated from recorded spending, scheduled bills, and plans you saved.</p></div>
    </section>
    <MonthsCompare evidence={evidence} forecastMonth={month} />
  </div>;
}
