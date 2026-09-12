import { STATE, money, prettyDate } from '../components/ui.jsx';
import { AreaChart } from '../components/charts.jsx';
import IncomeList from '../components/IncomeList.jsx';

export default function ForecastPage({ h, sc, plan, change, sim, cap }) {
  const [st, tone] = STATE[sim.worst];
  return (
    <>
      <div className="topbar"><div><h1>Forecast</h1><div className="sub">Day by day through {prettyDate(sim.days[sim.days.length - 1].date)} · lowest {money(sim.low.balance)} on {prettyDate(sim.low.date)} · <span className={'pill ' + tone}>{st}</span></div></div></div>
      <div className="grid g32">
        <div className="grid" style={{ gap: 18 }}>
          <div className="card"><div className="hd"><h2>Projected checking balance</h2><span className="fine">Hover for the day's events</span></div><AreaChart h={h} sim={sim} id="fc" height={300} /></div>
          <div className="card"><div className="hd"><h2>Day by day</h2><span className="fine">Days with bills, purchases, income or transfers</span></div>
            <table><thead><tr><th>Date</th><th>Events</th><th className="r">End of day</th><th>Status</th></tr></thead><tbody>
              {sim.days.filter(d => d.events.length > 1).map(d => <tr key={d.key} className="hover"><td style={{ whiteSpace: 'nowrap' }}>{d.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td><td>{d.events.filter(e => !e.everyday).map((e, i) => <span key={i} className="pill neutral" style={{ marginRight: 6 }}>{e.purchase ? 'Planned purchase · ' : ''}{e.label} {e.amt > 0 ? '+' : ''}{money(e.amt)}</span>)}</td><td className="r"><b>{money(d.balance)}</b></td><td><span className={'pill ' + STATE[d.state][1]}>{STATE[d.state][0]}</span></td></tr>)}
            </tbody></table></div>
        </div>
        <div className="grid" style={{ gap: 18 }}>
          <div className="card"><h2>Assumptions</h2><div className="kv"><span className="k">Cushion</span><span className="v">{money(h.cushion)}</span><span className="k">Usual everyday spending</span><span className="v">{money(sim.dailySpend)}/day</span><span className="k">Savings contribution</span><span className="v">{money(sc.contribution)}{sim.contributionDate ? ` on ${prettyDate(new Date(sim.contributionDate + 'T12:00:00'))}` : ''}</span><span className="k">Supported contribution</span><span className="v">{money(cap)}</span></div><div className="fine">Supported = the largest contribution that keeps every day at or above the cushion. Spending covered by an allowance moves to the planned purchase date instead of being counted twice.</div></div>
          <IncomeList h={h} plan={plan} change={change} />
        </div>
      </div>
    </>
  );
}
