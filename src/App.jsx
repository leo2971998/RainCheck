import { useMemo, useState } from 'react';
import { useHousehold } from './hooks/useHousehold.js';
import { simulate, capacity, goalAt } from './engine/forecast.js';
import { buildOptions } from './engine/options.js';
import { buildAlerts } from './engine/alerts.js';
import { Icon, money, monthLabel } from './components/ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ForecastPage from './pages/ForecastPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import RecurringPage from './pages/RecurringPage.jsx';
import CashFlowPage from './pages/CashFlowPage.jsx';
import GoalsPage from './pages/GoalsPage.jsx';
import BillDrawer from './drawers/BillDrawer.jsx';
import CompareDrawer from './drawers/CompareDrawer.jsx';

const NAV = [['dashboard', 'Dashboard', 'dash'], ['forecast', 'Forecast', 'trend'], ['transactions', 'Transactions', 'list'], ['recurring', 'Recurring', 'repeat'], ['cashflow', 'Cash flow', 'bars'], ['goals', 'Goals', 'target']];

function Navigation({ page, setPage }) {
  return NAV.map(([id, label, icon]) => <button key={id} className={`nav${page === id ? ' on' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}><Icon n={icon} s={17} />{label}{id === 'recurring' && <span className="badge">1</span>}{id === 'transactions' && <span className="badge">2</span>}</button>);
}

function initialIncrease(h) {
  const bill = h.recurring.find(r => r.change);
  return bill ? bill.change.to - bill.amount : 0;
}

export default function App() {
  const data = useHousehold();
  if (data.loading) return <main><h1>RainCheck</h1><p role="status">Loading your household…</p></main>;
  return <Workspace key={data.source} {...data} />;
}

function Workspace({ household: h, transactions, notice, source }) {
  const [page, setPage] = useState('dashboard');
  const [drawer, setDrawer] = useState(null);
  const [sc, setSc] = useState(() => ({ increase: initialIncrease(h), contribution: h.goal.planned, cuts: {}, cancelled: {}, treatElectricAsNew: false, income: null }));
  const [confirm, setConfirm] = useState(null);
  const [applied, setApplied] = useState(null);
  const [found, setFound] = useState(true);
  const [protectedIds, setProtectedIds] = useState({ groceries: true });
  const sim = useMemo(() => simulate(h, sc), [h, sc]);
  const cap = useMemo(() => capacity(h, sc), [h, sc]);
  const goal = useMemo(() => {
    const c = applied ? sc.contribution : cap;
    const initial = goalAt(h, c);
    const result = applied?.id === 'date' && isFinite(initial.monthsNeeded) ? goalAt(h, c, initial.monthsNeeded) : initial;
    return { ...result, targetLabel: monthLabel(result.left) };
  }, [h, sc, cap, applied]);
  const alerts = useMemo(() => buildAlerts(h, sc, sim, cap, applied), [h, sc, sim, cap, applied]);
  const options = useMemo(() => buildOptions(h, sc, cap, protectedIds).map(option => ({
    ...option,
    p: option.detail,
    b: [option.before[0], option.id === 'date' ? String(option.before[1]) : money(option.before[1])],
    a: [option.after[0], option.id === 'date' ? String(option.after[1]) : money(option.after[1]), option.after[2]],
    cond: option.conditional,
    x: option.conditional ? 'A scenario until the provider confirms.' : option.id === 'reduce' ? 'Only allowances you have not protected are offered.' : '',
  })), [h, sc, cap, protectedIds]);
  const open = what => what.startsWith('page:') ? setPage(what.slice(5)) : setDrawer(what);
  const apply = () => {
    setSc(s => ({ ...s, ...confirm.apply, cuts: { ...s.cuts, ...(confirm.apply.cuts || {}) }, cancelled: { ...s.cancelled, ...(confirm.apply.cancelled || {}) } }));
    setApplied({ id: confirm.id, label: confirm.apply.label });
    setConfirm(null); setDrawer(null);
  };
  const transfer = { available: false, status: null, request: () => {} };
  const sourceLabel = source === 'nessie' ? 'Nessie sandbox' : source === 'snapshot' ? 'Saved sandbox snapshot' : 'Sample data';
  return <div className="app">
    <aside>
      <div className="brand"><span className="mark"><Icon n="spark" s={16} c="#fff" /></span><b>RainCheck</b></div>
      <nav aria-label="Main navigation"><Navigation page={page} setPage={setPage} /></nav>
      <div className="side-foot"><div className="acct"><span className="avatar">A</span>Alex Rivera</div>Everyday Checking · Savings<br />{sourceLabel}</div>
    </aside>
    <main>
      <nav className="tabs" aria-label="Mobile navigation"><Navigation page={page} setPage={setPage} /></nav>
      {page === 'dashboard' && <Dashboard h={h} source={source} sc={sc} setSc={setSc} sim={sim} cap={cap} goal={goal} alerts={alerts} open={open} applied={applied} found={found} setFound={setFound} />}
      {page === 'forecast' && <ForecastPage h={h} sc={sc} setSc={setSc} sim={sim} cap={cap} />}
      {page === 'transactions' && <TransactionsPage transactions={transactions} />}
      {page === 'recurring' && <RecurringPage h={h} sc={sc} setSc={setSc} open={open} />}
      {page === 'cashflow' && <CashFlowPage h={h} sc={sc} sim={sim} />}
      {page === 'goals' && <GoalsPage h={h} sc={sc} cap={cap} goal={goal} applied={applied} open={open} transfer={transfer} />}
    </main>
    {drawer === 'bill' && <BillDrawer h={h} notice={notice} sc={sc} setSc={setSc} cap={cap} onCompare={() => setDrawer('compare')} onClose={() => setDrawer(null)} />}
    {drawer === 'compare' && <CompareDrawer h={h} sc={sc} cap={cap} options={options} protectedIds={protectedIds} setProtectedIds={setProtectedIds} onApply={setConfirm} onClose={() => setDrawer(null)} />}
    {confirm && <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="confirm-plan-title"><div className="modal"><h2 id="confirm-plan-title">Apply this plan?</h2><div className="option on"><h3>{confirm.title}</h3><p>{confirm.p}</p></div><div className="alert"><b>This updates your plan. It does not move money.</b><p>Savings stay at {money(h.savings)} until you complete a transfer on the Goals page.</p></div><div className="row"><button className="btn" onClick={apply}><Icon n="check" s={15} />Apply</button><button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button></div></div></div>}
  </div>;
}
