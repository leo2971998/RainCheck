import { Icon, Kpi, STATE, money, prettyDate, longDate } from '../components/ui.jsx';
import { AreaChart, GoalChart, CashBars } from '../components/charts.jsx';
import IncomeList from '../components/IncomeList.jsx';
import Alerts from '../components/Alerts.jsx';

export default function Dashboard({ h, source, sc, setSc, sim, cap, goal, alerts, open, applied, found, setFound }) {
  const [st, tone] = STATE[sim.worst];
  const internet = h.recurring.find(r => r.change);
  const today = new Date(h.today + 'T12:00:00');
  const sourceLabel = { sample: 'Sample data', nessie: 'Nessie sandbox', snapshot: 'Saved sandbox snapshot' }[source];
  const headline = sim.worst === 'over' ? 'Your balance would go below zero before payday.' : sim.worst === 'below' ? 'Bills are covered, but your savings plan dips below your cushion.' : goal.gap > 0 ? 'Bills are covered, but your goal needs an adjustment.' : 'Bills are covered and your goal is on track.';
  return (
    <>
      <div className="topbar"><div><h1>{headline}</h1><div className="sub">{longDate(today)} · Next paycheck Friday, Oct 2 · Forecast through Oct 31</div></div>
        <div className="row"><span className="pill teal"><Icon n="bank" s={13} />{sourceLabel}</span><button className="btn ghost sm" disabled aria-label="Attention count"><Icon n="bell" s={15} />{alerts.length}</button></div></div>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Kpi label="Checking balance" value={money(h.checking)} sub="Everyday Checking" />
        <Kpi label="Lowest projected balance" value={money(sim.low.balance)} sub={`${prettyDate(sim.low.date)} · cushion ${money(h.cushion)}`} pill={<span className={'pill ' + tone}>{st}</span>} />
        <Kpi label="Contribution the plan supports" value={`${money(cap)}/mo`} sub={`Planned ${money(h.goal.planned)} · ${cap < h.goal.planned ? `${money(h.goal.planned - cap)} less after the bill change` : 'unchanged'}`} pill={cap < h.goal.planned ? <span className="pill warn"><Icon n="down" s={11} />{money(h.goal.planned - cap)}</span> : <span className="pill good">OK</span>} />
        <Kpi label={h.goal.label} value={money(goal.projected)} sub={`Projected of ${money(h.goal.target)} by ${goal.targetLabel}`} pill={goal.gap ? <span className="pill bad">{money(goal.gap)} short</span> : <span className="pill good">On track</span>} />
      </div>
      <div className="grid g32">
        <div className="grid" style={{ gap: 18 }}>
          <div className="card">
            <div className="hd"><div><h2>Projected checking balance</h2><div className="fine">Next 34 days · scheduled bills, expected income, everyday spending and your {money(sc.contribution)} contribution</div></div>
              <div className="legend"><span><i style={{ background: '#4F46E5' }}></i>Balance</span><span><i style={{ background: '#0D9488', borderRadius: '50%' }}></i>Paycheck</span><span><i style={{ background: '#fff', border: '2px solid #4F46E5', borderRadius: '50%', width: 8, height: 8 }}></i>Bill ≥ $100</span><span><i style={{ background: '#D97706', height: 2, width: 14 }}></i>Cushion</span></div></div>
            <AreaChart h={h} sim={sim} id="dash" />
          </div>
          <div className="grid g2">
            <div className="card">
              <div className="hd"><h2>What changed</h2><span className="pill warn"><Icon n="up" s={11} />1 increase detected</span></div>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="cat"><i className="rec"><Icon n="repeat" s={14} /></i></div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{internet.label}</div><div className="fine">{money(internet.amount)} → <b className="num" style={{ color: 'var(--ink)' }}>{money(internet.amount + sc.increase)}</b> per month · takes effect Oct 1</div><div className="fine">{internet.change.why}, per the notice{sc.increase !== 25 ? ' · amount edited for the demo' : ''}</div></div>
              </div>
              <div className="row wrap" style={{ gap: 8 }}><button className="btn sm" onClick={() => open('bill')}>See what changed</button><button className="btn ghost sm" onClick={() => open('compare')}>Compare options</button></div>
            </div>
            <div className="card">
              <div className="hd"><h2>{h.goal.label}</h2><span className={'pill ' + (goal.gap ? 'bad' : 'good')}>{goal.gap ? `${money(goal.gap)} short` : 'On track'}</span></div>
              <GoalChart h={h} goal={goal} cap={applied ? sc.contribution : cap} />
              <div className="row between fine"><span>Saved <b className="num">{money(h.goal.saved)}</b> · projected <b className="num">{money(goal.projected)}</b></span><span>Updated plan <b className="num">{money(applied ? sc.contribution : cap)}/mo</b></span></div>
              {applied && <span className="pill good"><Icon n="check" s={11} />{applied.label}</span>}
            </div>
          </div>
          <div className="card">
            <div className="hd"><h2>Cash flow</h2><span className="fine">October is projected from the forecast</span></div>
            <CashBars h={h} sim={sim} />
          </div>
        </div>
        <div className="grid" style={{ gap: 18 }}>
          {found && <div className="card" style={{ background: 'linear-gradient(135deg, #EEF0FF, #F6F7FB)' }}><div className="hd"><h2>Here is what we found</h2><button className="link" onClick={() => setFound(false)}>Dismiss</button></div>
            <div className="row wrap" style={{ gap: 6 }}><span className="pill good"><Icon n="check" s={11} />Paycheck about every two weeks</span><span className="pill good"><Icon n="check" s={11} />7 recurring commitments</span><span className="pill warn">2 transactions need review</span></div>
            <div><button className="btn ghost sm" onClick={() => open('page:transactions')}>Review my plan</button></div></div>}
          <Alerts alerts={alerts} open={open} />
          <IncomeList h={h} sc={sc} setSc={setSc} compact />
        </div>
      </div>
    </>
  );
}
