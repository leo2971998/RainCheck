import { useMemo, useState } from 'react';
import { filterTransactions, sortTransactions } from '../engine/transaction-filters.js';
import './TransactionsPage.css';
import { Icon, moneyPrecise } from '../components/ui.jsx';

const KIND_ICON = { in: ['dollar', 'in'], rec: ['repeat', 'rec'], tr: ['swap', 'tr'], ev: ['cart', ''] };
const FILTERS = [['all', 'All'], ['review', 'Needs review'], ['in', 'Income'], ['rec', 'Recurring'], ['ev', 'Everyday'], ['tr', 'Transfers']];
// Why a row cannot be recategorised, in the same words the engine uses.
const FIXED_REASON = { tr: 'Your own account', in: 'Income, not a category', rec: 'Set by the bill' };

export default function TransactionsPage({ transactions, allowances = [], corrections: fixes = {}, setCorrections: setFixes }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [date, setDate] = useState('all');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const reset = () => { setFilter('all'); setQuery(''); setDate('all'); setCategory(''); setFrom(''); setTo(''); setMin(''); setMax(''); };
  const invalidDates = date === 'custom' && from && to && from > to;
  const invalidAmounts = min !== '' && max !== '' && Number(min) > Number(max);
  const active = filter !== 'all' || query || date !== 'all' || category || min !== '' || max !== '';
  const [editing, setEditing] = useState(null);   // corrections live in App, so they persist

  const keyOf = (t, i) => `${t.d}|${t.what}|${t.amt}|${i}`;

  // Categories the user can pick from: what the bank history actually taught us, plus the two
  // kinds of row that are not spending at all.
  const categories = useMemo(() => {
    const fromData = [...new Set(transactions.map(t => t.cat).filter(Boolean))];
    return [...new Set([...allowances.map(a => a.label), ...fromData, ...Object.values(fixes), 'Income', 'Transfer'])].sort();
  }, [transactions, allowances, fixes]);

  const rows = sortTransactions(filterTransactions(transactions.map((t, i) => ({ ...t, key: keyOf(t, i),
    cat: fixes[keyOf(t, i)] ?? t.cat, corrected: keyOf(t, i) in fixes })),
    { kind: filter, query, category, date, from, to, min, max }), sort);

  const span = transactions.length ? `${transactions[transactions.length - 1].d} – ${transactions[0].d}` : 'No activity';
  const needReview = transactions.filter(t => t.note).length;

  return (
    <>
      <div className="topbar">
        <div><h1>Transactions</h1>
          <div className="sub">{span} · {transactions.length} transactions{needReview ? ` · ${needReview} worth a second look` : ''}</div></div>
        <label className="search">
          <Icon n="search" s={15} />
          <input value={query} onChange={e => setQuery(e.target.value)} type="search" placeholder="Search transactions"
            aria-label="Search transactions" style={{ border: 0, outline: 'none', font: 'inherit', background: 'transparent', color: 'var(--ink)', width: 190 }} />
        </label>
      </div>

      <div className="card transaction-card">
        <div className="hd">
          <div className="chips">{FILTERS.map(([id, label]) =>
            <button key={id} className={'chip' + (filter === id ? ' on' : '')} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
        </div>

        <div className="transaction-filters" role="group" aria-label="Transaction filters">
          <label>Date<select value={date} onChange={e => setDate(e.target.value)}>
            <option value="all">All dates</option><option value="today">Today</option>
            <option value="week">Last 7 days</option><option value="month">This month</option>
            <option value="last-month">Last month</option><option value="custom">Custom date range</option>
          </select></label>
          <label>Category<select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select></label>
          <label>Minimum amount ($)<input type="number" min="0" step="0.01" placeholder="No minimum" value={min} aria-invalid={!!invalidAmounts} onChange={e => setMin(e.target.value)} /></label>
          <label>Maximum amount ($)<input type="number" min="0" step="0.01" placeholder="No maximum" value={max} aria-invalid={!!invalidAmounts} onChange={e => setMax(e.target.value)} /></label>
          {date === 'custom' && <>
            <label>From<input type="date" value={from} max={to || undefined} aria-invalid={!!invalidDates} onChange={e => setFrom(e.target.value)} /></label>
            <label>To<input type="date" value={to} min={from || undefined} aria-invalid={!!invalidDates} onChange={e => setTo(e.target.value)} /></label>
          </>}
          <label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="amount-asc">Amount: lowest to highest</option>
            <option value="amount-desc">Amount: highest to lowest</option>
            <option value="review">Needs review first</option>
          </select></label>
          <button className="btn ghost sm" disabled={!active} onClick={reset}>Clear filters</button>
        </div>
        <div className="transaction-filter-summary">
          <span role="status">Showing {rows.length} of {transactions.length} transactions</span>
        </div>
        {(invalidDates || invalidAmounts) && <p role="alert" className="transaction-filter-error">{invalidDates ? 'From date must be on or before To date.' : 'Minimum amount must be less than or equal to maximum amount.'}</p>}

        <table className="transaction-table">
          <thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th className="r">Amount</th><th></th></tr></thead>
          <tbody>
            {rows.map(t => {
              const [icon, cls] = KIND_ICON[t.k] || KIND_ICON.ev;
              return (
                <tr key={t.key} className="hover">
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{t.d}</td>
                  <td><div className="cat"><i className={t.note ? 'rev' : cls}><Icon n={t.note ? 'warn' : icon} s={14} /></i>
                    <div><div style={{ fontWeight: 500 }}>{t.what}</div>{t.note && <div className="fine">{t.note}</div>}</div></div></td>
                  <td>
                    {editing === t.key && t.k === 'ev'
                      ? <select autoFocus value={t.cat} aria-label={`Category for ${t.what}`}
                          onChange={e => { setFixes(f => ({ ...f, [t.key]: e.target.value })); setEditing(null); }}
                          onBlur={() => setEditing(null)}
                          style={{ font: 'inherit', padding: '4px 6px', borderRadius: 8, border: '1px solid var(--line)' }}>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      : <span className={'pill ' + (t.corrected ? 'accent' : t.note ? 'warn' : 'neutral')}>{t.cat}{t.corrected ? ' · corrected' : ''}</span>}
                  </td>
                  <td className="r" style={{ fontWeight: 600, color: t.amt > 0 ? 'var(--good)' : undefined }}>{t.amt > 0 ? '+' : ''}{moneyPrecise(t.amt)}</td>
                  <td className="r">
                    {/* Only everyday spending has a category to argue about. A transfer between your
                        own accounts is not spending, a paycheck is not a category, and a bill's
                        category comes from the bill itself — offering to reclassify any of them
                        invited a label that contradicts the rule stated in the row's own note. */}
                    {t.k !== 'ev'
                      ? <span className="fine">{FIXED_REASON[t.k]}</span>
                      : t.corrected
                        ? <button className="btn ghost sm" onClick={() => setFixes(({ [t.key]: _, ...rest }) => rest)}>Undo</button>
                        : <button className="btn ghost sm" onClick={() => setEditing(t.key)}>Change category</button>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan="5" className="muted" style={{ padding: 18 }}>No transactions match this filter.</td></tr>}
          </tbody>
        </table>

      </div>
    </>
  );
}
