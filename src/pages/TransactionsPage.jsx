import { useMemo, useState } from 'react';
import { Icon, moneyPrecise } from '../components/ui.jsx';

const KIND_ICON = { in: ['dollar', 'in'], rec: ['repeat', 'rec'], tr: ['swap', 'tr'], ev: ['cart', ''] };
const FILTERS = [['all', 'All'], ['review', 'Needs review'], ['in', 'Income'], ['rec', 'Recurring'], ['ev', 'Everyday'], ['tr', 'Transfers']];

export default function TransactionsPage({ transactions, allowances = [], corrections: fixes = {}, setCorrections: setFixes }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);   // corrections live in App, so they persist

  const keyOf = (t, i) => `${t.d}|${t.what}|${t.amt}|${i}`;

  // Categories the user can pick from: what the bank history actually taught us, plus the two
  // kinds of row that are not spending at all.
  const categories = useMemo(() => {
    const fromData = [...new Set(transactions.map(t => t.cat).filter(Boolean))];
    return [...new Set([...allowances.map(a => a.label), ...fromData, 'Income', 'Transfer'])].sort();
  }, [transactions, allowances]);

  const rows = transactions
    .map((t, i) => ({ ...t, key: keyOf(t, i), cat: fixes[keyOf(t, i)] ?? t.cat, corrected: keyOf(t, i) in fixes }))
    .filter(t => filter === 'all' || (filter === 'review' ? t.note : t.k === filter))
    .filter(t => !query || `${t.what} ${t.cat}`.toLowerCase().includes(query.toLowerCase()));

  const span = transactions.length ? `${transactions[transactions.length - 1].d} – ${transactions[0].d}` : 'No activity';
  const needReview = transactions.filter(t => t.note).length;

  return (
    <>
      <div className="topbar">
        <div><h1>Transactions</h1>
          <div className="sub">{span} · {transactions.length} transactions{needReview ? ` · ${needReview} worth a second look` : ''}</div></div>
        <label className="search">
          <Icon n="search" s={15} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search merchant or category"
            aria-label="Search transactions" style={{ border: 0, outline: 'none', font: 'inherit', background: 'transparent', width: 190 }} />
        </label>
      </div>

      <div className="card transaction-card">
        <div className="hd">
          <div className="chips">{FILTERS.map(([id, label]) =>
            <button key={id} className={'chip' + (filter === id ? ' on' : '')} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
          <span className="fine">Transfers are not income · a bill and its charge count once · repeat purchases are not auto-subscriptions</span>
        </div>

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
                    {editing === t.key
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
                    {t.corrected
                      ? <button className="btn ghost sm" onClick={() => setFixes(({ [t.key]: _, ...rest }) => rest)}>Undo</button>
                      : <button className="btn ghost sm" onClick={() => setEditing(t.key)}>Change category</button>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan="5" className="muted" style={{ padding: 18 }}>No transactions match this filter.</td></tr>}
          </tbody>
        </table>

        <div className="fine">
          A correction stays with that transaction, and is still here when you come back. It never rewrites your bills or moves the forecast on its own.
        </div>
      </div>
    </>
  );
}
