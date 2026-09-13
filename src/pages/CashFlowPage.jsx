import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, prettyIso } from '../components/ui.jsx';
import { budgetMoney as money } from '../components/BudgetImpact.jsx';
import { spendingInsights } from '../engine/spending-insights.js';
import { simulate } from '../engine/forecast.js';
import useBudgetOptimization from '../hooks/useBudgetOptimization.js';
import SavingsPlanner from '../drawers/SavingsPlanner.jsx';
import './SpendingSavings.css';

const monthName = key => new Date(key + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export default function CashFlowPage({ base, baseVersion, h, sc, plan, protectedIds = {}, setProtectedIds, change, open }) {
  const insight = useMemo(() => spendingInsights(h, sc, protectedIds), [h, sc, protectedIds]);
  const [planner, setPlanner] = useState(false), [saved, setSaved] = useState(false);
  const optimization = useBudgetOptimization({ baseVersion, plan, protectedIds });
  const upcoming = useMemo(() => simulate(h, sc, { days: 30 }).days.flatMap(d =>
    d.events.filter(e => e.bill && sc.paid?.[e.id] !== d.key.slice(0, 7)).map(e => ({ ...e, date: d.key }))), [h, sc]);
  const billsTotal = upcoming.reduce((sum, b) => sum - b.amt, 0);
  const optimize = () => { setPlanner(true); optimization.start(); };
  const close = () => { optimization.cancel(); setPlanner(false); };
  return <div className="spending-page">
    <div className="topbar"><div><h1>Spending &amp; Savings</h1><div className="sub">Your bills. Your limits. A little more room.</div></div>
      <button className="btn" onClick={optimize}><Icon n="target" s={16} />Optimize budgets</button></div>
    <div className="spending-meta"><p>{monthName(insight.month)} · Recorded through {prettyIso(insight.asOf)}</p>
      <details><summary>About optimization</summary><p>Clicking Optimize budgets sends category summaries and calculated proposals through ZeroClaw to its cloud AI for review. No raw receipts or account credentials are shared. Reviews stay on your server; changes need your confirmation.</p></details></div>
    {saved && <p className="alert good" role="status">Your budgets were updated. No money moved. You can undo this from Today.</p>}
    <div className="spending-panels">
      <section className="spending-panel spending-upcoming" aria-label="Upcoming bills">
        <header className="spending-panel-heading"><span className="spending-panel-icon"><Icon n="repeat" s={20} /></span><div><h2>Upcoming bills</h2><p>Next 30 days · scheduled amounts</p></div></header>
        <div className="spending-panel-total"><strong className="num">{money(billsTotal)}</strong><span>{upcoming.length} payment{upcoming.length === 1 ? '' : 's'} coming up</span></div>
        {upcoming.length ? <ul className="upcoming-bill-list">{upcoming.map(b => <li key={b.id + b.date}>
          <span className="bill-date">{prettyIso(b.date)}</span><b>{b.label}</b><strong className="num">{money(-b.amt)}</strong>
        </li>)}</ul> : <p className="savings-empty">No bills scheduled in the next 30 days.</p>}
        <button className="btn ghost sm" onClick={() => open('page:recurring')}>View scheduled bills<Icon n="arrow" s={14} /></button>
      </section>
      <section className="spending-panel spending-expenses" aria-label="Expenses">
        <header className="spending-panel-heading"><span className="spending-panel-icon"><Icon n="bars" s={20} /></span><div><h2>Expenses</h2><p>Spent this month against your monthly limits</p></div></header>
        <div className="spending-panel-total"><strong className="num">{insight.spent == null ? '—' : money(insight.spent)}</strong><span>of {money(insight.budget)} · bills listed separately</span></div>
        {!insight.available && <p className="savings-empty">Load spending records to compare your expenses. Limits below are estimates, not actual spending.</p>}
        <ul className="expense-list">{insight.categories.map(c => <li className={'expense-row' + (c.over > 0 ? ' is-over' : '')} key={c.id}>
          <div className="expense-row-heading"><h3>{c.label}</h3><span><b className="num">{c.spent == null ? '—' : money(c.spent)}</b> / {money(c.budget)}</span></div>
          <progress className="category-progress" aria-label={c.label + ' monthly limit used'} value={Math.min(c.spent || 0, c.budget)} max={Math.max(c.budget, 1)} />
          <div className="expense-row-foot"><span>{c.status === 'reclassified' ? 'History needs separating from bills' : c.spent == null ? 'Records unavailable'
            : c.over > 0 ? money(c.over) + ' over the limit' : money(c.remaining) + ' left'}</span>
            <label><input type="checkbox" checked={c.protected} onChange={e => setProtectedIds(p => ({ ...p, [c.id]: e.target.checked }))} />Keep unchanged</label></div>
          <details className="category-history"><summary>Spending details</summary>
            {c.oneOff > 0 && <p>Includes {money(c.oneOff)} in identified one-time purchases.</p>}
            {c.status === 'pace' && <p>About {money(c.projected - c.budget)} above this limit by month-end if the recorded pattern continues.</p>}
            <dl>{c.months.map(m => <div key={m.key}><dt>{monthName(m.key)}{m.key === insight.month ? ' · so far' : ''}</dt><dd>{money(m.spent ?? m.total)}</dd></div>)}</dl>
            <p>{c.completeMonths} complete months inform the estimate. Missing records can change it.</p>
          </details>
        </li>)}</ul>
        {!insight.categories.length && <p className="savings-empty">No expense categories available yet.</p>}
        <p className="fine">Keep unchanged protects a category during optimization. Limits are planning estimates, not bank restrictions.</p>
      </section>
    </div>
    <p className="spending-footnote">No money moves automatically. Review your proposed limits before saving any changes.</p>
    {planner && createPortal(<SavingsPlanner base={base || h} baseVersion={baseVersion} plan={plan} protectedIds={protectedIds}
      optimization={optimization.state} onRetry={optimization.start}
      change={(patch, label) => { change(patch, label); setSaved(true); }} onClose={close} />, document.body)}
  </div>;
}
