import { budgetMoney, budgetDate } from '../components/BudgetImpact.jsx';
import { purchaseState } from '../engine/purchases.js';

export default function PurchasesPage({ h, available, open, refresh }) {
  const records = h.plannedPurchases || [];
  const planned = records.filter(p => p.status === 'planned').sort((a,b) => a.date.localeCompare(b.date));
  const history = records.filter(p => p.status !== 'planned').reverse();
  return <>
    <div className="topbar"><div><h1>Planned purchases</h1><div className="sub">See what a one-time purchase would change, before you spend.</div></div>
      <button className="btn" disabled={!available} onClick={() => open('purchase')}>Plan a purchase</button></div>
    {!available ? <p className="alert">Saved purchases are available in the local demo workspace. They aren’t connected to this hosted or sample workspace yet.</p> : <>
      <div className="purchase-intro"><span>1 · Enter a cost and date</span><span>2 · Preview your budget</span><span>3 · Save only if you want to</span></div>
      <section className="card purchase-card" aria-label="Upcoming purchases">
        <div className="hd"><h2>Coming up</h2><span className="pill teal">{planned.length} planned</span></div>
        {planned.length ? <ul className="purchase-list">{planned.map(p => <li key={p.id}>
          <div className="purchase-main"><b>{p.label}</b><span>{budgetDate(p.date)} · {p.allowanceId ? 'Uses a spending allowance' : 'Extra spending'}</span>
            {purchaseState(p, h.today) === 'overdue' && <span className="purchase-overdue">Still planned? We’re keeping this amount reserved for now.</span>}</div>
          <strong className="purchase-amount">{budgetMoney(p.amount)}</strong>
          <button className="btn ghost sm" aria-label={`Review ${p.label}`} onClick={() => open('purchase', p.id)}>Review</button>
        </li>)}</ul> : <div className="purchase-empty"><h3>A little planning, fewer surprises.</h3><p>Concert tickets, a repair or a weekend away? Preview the effect on checking and your savings goal.</p>
          <button className="btn ghost" onClick={() => open('purchase')}>Try your first purchase</button></div>}
        <p className="fine">Estimates only. Saving here doesn’t schedule a payment or reserve money at your bank. Forecast date: {budgetDate(h.today)}.</p>
      </section>
      <details className="card purchase-history"><summary>Completed & removed · {history.length}</summary>
        {history.length ? <ul className="purchase-list">{history.map(p => <li key={p.id}><div className="purchase-main"><b>{p.label}</b><span>{p.status === 'completed'
          ? `Matched to a posted charge on ${budgetDate(p.actualDate)}. No longer counted as a future purchase.`
          : 'Removed from the forecast. No order or bank payment was cancelled.'}</span></div>
          <strong>{budgetMoney(p.status === 'completed' ? p.actualAmount : p.amount)}</strong><span className={`pill ${p.status === 'completed' ? 'good' : 'neutral'}`}>{p.status === 'completed' ? 'Completed' : 'Removed'}</span></li>)}</ul>
          : <p>Your purchase history will appear here.</p>}
      </details>
      <div className="purchase-footer"><p className="fine">Saved in the shared local demo database. “Reset demo” only resets browser decisions; it won’t remove these purchases.</p>
        <button className="btn ghost sm" onClick={refresh}>Refresh purchases</button></div>
    </>}
  </>;
}
