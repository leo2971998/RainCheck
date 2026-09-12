import { money } from '../components/ui.jsx';
import { CashBars } from '../components/charts.jsx';

export default function CashFlowPage({ h, sc, sim }) {
  return (
    <>
<<<<<<< Updated upstream
      <div className="topbar"><div><h1>Cash flow</h1><div className="sub">Income against spending, with October projected from the forecast</div></div></div>
      <div className="grid g32">
        <div className="card"><div className="hd"><h2>Monthly</h2><div className="legend"><span><i style={{ background: 'var(--teal)' }}></i>Income</span><span><i style={{ background: 'var(--cloud-deep)' }}></i>Spending</span></div></div><CashBars h={h} sim={sim} /></div>
        <div className="card"><div className="hd"><h2>Everyday allowances</h2><span className="fine">Monthly, spread across days</span></div>
          {h.allowances.map(a => { const cut = sc.cuts?.[a.id] || 0; return <div className="hbar" key={a.id}><span>{a.label}</span><div className="t"><i className="cut" style={{ width: a.monthly / 700 * 100 + '%' }}></i><i style={{ width: (a.monthly - cut) / 700 * 100 + '%' }}></i></div><span className="num" style={{ textAlign: 'right' }}>{cut ? <><span className="muted" style={{ textDecoration: 'line-through' }}>{money(a.monthly)}</span> {money(a.monthly - cut)}</> : money(a.monthly)}</span></div>; })}
=======
      <div className="topbar"><div><h1>Cash flow</h1><div className="sub">Income against spending, with the current month projected from the forecast</div></div></div>
      <div className="grid g32">
        <div className="card"><div className="hd"><h2>Monthly</h2><div className="legend"><span><i style={{ background: 'var(--teal)' }}></i>Income</span><span><i style={{ background: '#C7CBE0' }}></i>Spending</span></div></div><CashBars h={h} sim={sim} /></div>
        <div className="card"><div className="hd"><h2>Everyday allowances</h2><span className="fine">Monthly, spread across days</span></div>
          {(() => { const widest = Math.max(...h.allowances.map(x => x.monthly), 1); return h.allowances.map(a => { const cut = sc.cuts?.[a.id] || 0; return <div className="hbar" key={a.id}><span>{a.label}</span><div className="t"><i className="cut" style={{ width: a.monthly / widest * 100 + '%' }}></i><i style={{ width: (a.monthly - cut) / widest * 100 + '%' }}></i></div><span className="num" style={{ textAlign: 'right' }}>{cut ? <><span className="muted" style={{ textDecoration: 'line-through' }}>{money(a.monthly)}</span> {money(a.monthly - cut)}</> : money(a.monthly)}</span></div>; }); })()}
>>>>>>> Stashed changes
          <div className="fine">Learned from three months of transactions. Trimmed allowances show the old amount struck through.</div></div>
      </div>
    </>
  );
}
