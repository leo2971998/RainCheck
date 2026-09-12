import { Icon, Kpi, money } from '../components/ui.jsx';

export default function RecurringPage({ h, sc, setSc, open }) {
  const total = h.recurring.reduce((a, r) => a + (r.change ? r.amount + sc.increase : r.id === 'electric' && sc.treatElectricAsNew ? r.lastPosted : r.amount), 0);
  return (
    <>
      <div className="topbar"><div><h1>Recurring</h1><div className="sub">7 commitments · {money(total)} per month · 1 increase detected</div></div></div>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Kpi label="Monthly recurring" value={money(total)} sub="Across 7 commitments" />
        <Kpi label="Due in the next 7 days" value={money(h.recurring.filter(r => r.day <= 5).reduce((a, r) => a + (r.change ? r.amount + sc.increase : r.amount), 0))} sub="Internet Oct 1 · Streaming Oct 3 · Rent Oct 5" />
        <Kpi label="Changes detected" value="1" sub="Internet · confirmed from a notice" pill={<span className="pill warn"><Icon n="up" s={11} />{money(sc.increase)}</span>} />
        <Kpi label="Unexplained" value="1" sub="Electric posted $128, usually $110" pill={<span className="pill neutral">Needs a decision</span>} />
      </div>
      <div className="card">
        <table><thead><tr><th>Commitment</th><th>Next</th><th>Frequency</th><th className="r">Amount</th><th>Status</th><th></th></tr></thead><tbody>
          {h.recurring.map(r => <tr key={r.id} className="hover">
            <td><div className="cat"><i className="rec"><Icon n="repeat" s={14} /></i><span style={{ fontWeight: 500 }}>{r.label}</span></div></td>
            <td>Oct {r.day}</td><td className="muted">{r.freq}</td>
            <td className="r">{r.change ? <><span className="muted" style={{ textDecoration: 'line-through' }}>{money(r.amount)}</span> <b>{money(r.amount + sc.increase)}</b></> : r.id === 'electric' && sc.treatElectricAsNew ? <b>{money(r.lastPosted)}</b> : money(r.amount)}</td>
            <td>{r.change ? <span className="pill warn"><Icon n="up" s={11} />Increase from notice</span> : r.unexplained ? <span className="pill neutral">Posted {money(r.lastPosted)} · not confirmed why</span> : sc.cancelled?.[r.id] ? <span className="pill accent">Cancel pending</span> : r.renews ? <span className="pill neutral">Renews Oct 15</span> : <span className="pill good">Steady</span>}</td>
            <td className="r">{r.change && <button className="btn sm" onClick={() => open('bill')}>Review</button>}{r.unexplained && <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}><button className={'btn sm' + (sc.treatElectricAsNew ? ' ghost' : '')} onClick={() => setSc(s => ({ ...s, treatElectricAsNew: false }))}>One-time</button><button className={'btn sm' + (sc.treatElectricAsNew ? '' : ' ghost')} onClick={() => setSc(s => ({ ...s, treatElectricAsNew: true }))}>New price</button></div>}</td>
          </tr>)}
        </tbody></table>
        <div className="fine">"The amount changed. We have not confirmed why." is an honest state. Your decision on Electric changes the forecast immediately.</div>
      </div>
    </>
  );
}
