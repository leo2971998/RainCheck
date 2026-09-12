import { useState } from 'react';
import { Icon, moneyPrecise } from '../components/ui.jsx';

const KIND_ICON = { in: ['dollar', 'in'], rec: ['repeat', 'rec'], tr: ['swap', 'tr'], ev: ['cart', ''] };

export default function TransactionsPage({ transactions }) {
  const [f, setF] = useState('all');
  const rows = transactions.filter(t => f === 'all' || (f === 'review' ? t.review : t.k === f));
  return (
    <>
      <div className="topbar"><div><h1>Transactions</h1><div className="sub">September 1 – 28 · {transactions.length} transactions · {transactions.filter(t => t.review).length} need review</div></div><div className="search" aria-disabled="true" title="Search is not available in this demo"><Icon n="search" s={15} />Search unavailable</div></div>
      <div className="card">
        <div className="hd"><div className="chips">{[['all', 'All'], ['review', 'Needs review'], ['in', 'Income'], ['rec', 'Recurring'], ['ev', 'Everyday'], ['tr', 'Transfers']].map(([id, l]) => <button key={id} className={'chip' + (f === id ? ' on' : '')} onClick={() => setF(id)}>{l}</button>)}</div><span className="fine">Transfers are not income · receipts match once · repeat purchases are not auto-subscriptions</span></div>
        <table><thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th className="r">Amount</th><th></th></tr></thead><tbody>
          {rows.map((t, i) => { const [ic, cls] = KIND_ICON[t.k]; return <tr key={i} className="hover"><td className="muted" style={{ whiteSpace: 'nowrap' }}>{t.d}</td><td><div className="cat"><i className={t.review ? 'rev' : cls}><Icon n={t.review ? 'warn' : ic} s={14} /></i><div><div style={{ fontWeight: 500 }}>{t.what}</div>{(t.note || t.review) && <div className="fine">{t.review || t.note}</div>}</div></div></td><td><span className={'pill ' + (t.review ? 'warn' : 'neutral')}>{t.review ? 'Needs review' : t.cat}</span></td><td className="r" style={{ fontWeight: 600, color: t.amt > 0 ? 'var(--good)' : undefined }}>{t.amt > 0 ? '+' : ''}{moneyPrecise(t.amt)}</td><td className="r">{t.review && <button className="btn ghost sm" disabled title="Category editing is not available in this demo">Fix category</button>}</td></tr>; })}
        </tbody></table>
      </div>
    </>
  );
}
