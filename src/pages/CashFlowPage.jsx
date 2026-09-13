import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, prettyIso } from '../components/ui.jsx';
import { budgetMoney as money } from '../components/BudgetImpact.jsx';
import SavingsGoals from '../components/SavingsGoals.jsx';
import { spendingInsights } from '../engine/spending-insights.js';
import { simulate } from '../engine/forecast.js';
import useBudgetOptimization from '../hooks/useBudgetOptimization.js';
import SavingsPlanner from '../drawers/SavingsPlanner.jsx';
import './SpendingSavings.css';

const monthName = key => new Date(key + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/**
 * One page for the whole of it: what is going out, what it is going on, and what is being kept.
 * Goals live here rather than on a page of their own because Optimize budgets is the bridge —
 * it looks for room in the categories below and offers that room to the goals underneath them.
 */
export default function CashFlowPage({ base, baseVersion, h, sc, plan, goal, protectedIds = {}, setProtectedIds,
  change, open, history, onUndo }) {
  const insight = useMemo(() => spendingInsights(h, sc, protectedIds), [h, sc, protectedIds]);
  const [planner, setPlanner] = useState(false), [saved, setSaved] = useState(false);
  const optimization = useBudgetOptimization({ baseVersion, plan, protectedIds });
  const upcoming = useMemo(() => simulate(h, sc, { days: 30 }).days.flatMap(d =>
    d.events.filter(e => e.bill && sc.paid?.[e.id] !== d.key.slice(0, 7)).map(e => ({ ...e, date: d.key }))), [h, sc]);
  const billsTotal = upcoming.reduce((sum, b) => sum - b.amt, 0);
  const optimize = () => { setPlanner(true); optimization.start(); };
  const close = () => { optimization.cancel(); setPlanner(false); };
  const lastAction = history?.at(-1);
  return <div className="spending-page">
    <div className="topbar"><div><h1>Spending &amp; Savings</h1><div className="sub">Your bills. Your limits. What the rest is for.</div></div>
      <button className="btn" onClick={optimize}><Icon n="target" s={16} />Optimize budgets</button></div>
    {/* Bills are committed money: they frame the limits below without being editable here, so the
        total earns its place and the seven-row list does not. The list lives on Recurring. */}
    <div className="spending-meta">
      <p>{monthName(insight.month)} · Recorded through {prettyIso(insight.asOf)}</p>
      <p className="spending-bills-note"><b className="num">{money(billsTotal)}</b> in bills over the next 30 days
        {upcoming.length ? ` (${upcoming.length} payment${upcoming.length === 1 ? '' : 's'})` : ''} · not part of the limits below{' '}
        <button className="link" onClick={() => open('page:recurring')}>See them<Icon n="arrow" s={13} /></button></p>
      <details><summary>About optimization</summary><p>Optimize budgets looks for room in the categories below and offers it to your goals. Category summaries and calculated proposals go through ZeroClaw to its cloud AI for review. No raw receipts or account credentials are shared. Reviews stay on your server; changes need your confirmation.</p></details></div>
    {saved && <p className="alert good" role="status">Your budgets were updated. You can undo this below or from Today.</p>}
    <div className="spending-panels">
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
    {goal && <SavingsGoals h={h} base={base || h} plan={plan} goal={goal} open={open} />}
    {lastAction && <div className="spending-undo"><span>{lastAction.label}</span><button className="link" onClick={onUndo}>Undo</button></div>}
    {planner && createPortal(<SavingsPlanner base={base || h} baseVersion={baseVersion} plan={plan} protectedIds={protectedIds}
      optimization={optimization.state} onRetry={optimization.start}
      change={(patch, label) => { change(patch, label); setSaved(true); }} onClose={close} />, document.body)}
  </div>;
}
