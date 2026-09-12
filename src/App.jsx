import { useEffect, useMemo, useState } from 'react';
import { useHousehold } from './hooks/useHousehold.js';
import { useTransfer } from './hooks/useTransfer.js';
import { usePersistentState, clearPersisted, hasPersisted } from './hooks/usePersistentState.js';
import { simulate, capacity, goalAt, hypothetical } from './engine/forecast.js';
import { emptyPlan, applyPatch, revert, scenarioFor, householdFor } from './engine/plan.js';
import { buildOptions, currentOutcome } from './engine/options.js';
import { buildAlerts } from './engine/alerts.js';
import { Icon, money, monthOf } from './components/ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ForecastPage from './pages/ForecastPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import RecurringPage from './pages/RecurringPage.jsx';
import CashFlowPage from './pages/CashFlowPage.jsx';
import GoalsPage from './pages/GoalsPage.jsx';
import BillDrawer from './drawers/BillDrawer.jsx';
import CompareDrawer from './drawers/CompareDrawer.jsx';

const NAV = [['dashboard', 'Dashboard', 'dash'], ['forecast', 'Forecast', 'trend'], ['transactions', 'Transactions', 'list'], ['recurring', 'Recurring', 'repeat'], ['cashflow', 'Cash flow', 'bars'], ['goals', 'Goals', 'target']];

function Navigation({ page, setPage, badges = {} }) {
  return NAV.map(([id, label, icon]) => (
    <button key={id} className={`nav${page === id ? ' on' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>
      <Icon n={icon} s={17} />{label}
      {badges[id] > 0 && <span className="badge" aria-label={`${badges[id]} need attention`}>{badges[id]}</span>}
    </button>
  ));
}

export default function App() {
  const data = useHousehold();
  if (data.loading) return <main><h1>RainCheck</h1><p role="status">Loading your household…</p></main>;
  return <Workspace key={data.source} {...data} />;
}

function Workspace({ household: base, transactions, notice, source }) {
  const [page, setPage] = useState('dashboard');
  const [drawer, setDrawer] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [previewId, setPreviewId] = useState(null);      // an option's identity, not a snapshot of it

  // One accepted plan, plus the history that built it. Everything the user decides persists.
  const [planSaved, setPlanSaved] = usePersistentState('plan', null);
  const [history, setHistory] = usePersistentState('history', []);
  const [corrections, setCorrections] = usePersistentState('corrections', {});
  const [protectedIds, setProtectedIds] = usePersistentState('protected', { groceries: true });
  const [found, setFound] = usePersistentState('found', true);

  const plan = planSaved ?? emptyPlan(base);
  const h = useMemo(() => householdFor(base, plan), [base, plan]);
  const sc = useMemo(() => scenarioFor(h, plan), [h, plan]);

  const sim = useMemo(() => simulate(h, sc), [h, sc]);
  const cap = useMemo(() => capacity(h, sc), [h, sc]);

  // The forecast shows what is scheduled. The goal shows what the plan can actually carry, unless
  // the user has accepted a contribution of their own.
  const goal = useMemo(() => {
    const g = goalAt(h, plan.contribution ?? cap);
    return { ...g, accepted: plan.contribution != null, targetLabel: monthOf(g.schedule[g.schedule.length - 1]) };
  }, [h, cap, plan.contribution]);

  const alerts = useMemo(() => buildAlerts(h, sc, sim, cap, lastAction(history)), [h, sc, sim, cap, history]);
  const options = useMemo(() => buildOptions(h, sc, cap, protectedIds), [h, sc, cap, protectedIds]);
  const current = useMemo(() => currentOutcome(h, sc), [h, sc]);

  // The preview always describes the option as it stands NOW. Protecting an allowance can replace
  // the trim option with a different category; the preview must follow, not describe the old one.
  const preview = useMemo(() => options.find(o => o.id === previewId && !o.disabled) ?? null, [options, previewId]);
  useEffect(() => { if (previewId && !preview) setPreviewId(null); }, [previewId, preview]);

  const previewSim = useMemo(() => (preview ? simulate(h, hypothetical(sc, preview.apply)) : null), [h, sc, preview]);
  const previewGoal = useMemo(() => (preview ? goalAt(h, preview.outcome.contribution, preview.outcome.goalLeft) : null), [h, preview]);

  const badges = useMemo(() => ({
    recurring: h.recurring.filter(r => r.change || (r.unexplained && !(r.id in (plan.treatAsNewPrice || {})))).length,
    transactions: transactions.filter(t => t.note).length,
  }), [h, transactions, plan]);

  const transfer = useTransfer(source);
  const open = what => what.startsWith('page:') ? (setDrawer(null), setPage(what.slice(5))) : setDrawer(what);

  /** Every change goes through here, so each one can be reversed on its own. */
  const change = (patch, label) => {
    const { plan: next, entry } = applyPatch(plan, patch, label ?? patch.label ?? 'Plan updated');
    setPlanSaved(next);
    setHistory(hs => [...hs, entry].slice(-20));
  };

  const applyOption = () => {
    change(confirm.apply, confirm.apply.label);
    setConfirm(null); setDrawer(null); setPreviewId(null);
  };

  const undo = () => {
    const entry = history[history.length - 1];
    if (!entry) return;
    setPlanSaved(revert(plan, entry));
    setHistory(hs => hs.slice(0, -1));
  };

  const resetAll = () => { clearPersisted(); window.location.reload(); };
  const sourceLabel = source === 'nessie' ? 'Nessie sandbox' : source === 'snapshot' ? 'Saved sandbox snapshot' : 'Sample data';

  return (
    <div className="app">
      <aside>
        <div className="brand"><span className="mark"><Icon n="spark" s={16} c="#fff" /></span><b>RainCheck</b></div>
        <nav aria-label="Main navigation"><Navigation page={page} setPage={setPage} badges={badges} /></nav>
        <div className="side-foot">
          <div className="acct"><span className="avatar">A</span>Alex Rivera</div>
          Everyday Checking · Savings<br />{sourceLabel}
          {hasPersisted() && <><br /><button className="link" style={{ fontSize: 12, marginTop: 6 }} onClick={resetAll}>Reset my decisions</button></>}
        </div>
      </aside>

      <main>
        <nav className="tabs" aria-label="Section navigation"><Navigation page={page} setPage={setPage} badges={badges} /></nav>
        {page === 'dashboard' && <Dashboard h={h} source={source} plan={plan} change={change} sim={sim} previewSim={previewSim} preview={preview} cap={cap} goal={goal} alerts={alerts} open={open} history={history} onUndo={undo} found={found} setFound={setFound} />}
        {page === 'forecast' && <ForecastPage h={h} sc={sc} plan={plan} change={change} sim={sim} cap={cap} goal={goal} />}
        {page === 'transactions' && <TransactionsPage transactions={transactions} allowances={h.allowances} corrections={corrections} setCorrections={setCorrections} />}
        {page === 'recurring' && <RecurringPage h={h} sc={sc} plan={plan} change={change} cap={cap} open={open} />}
        {page === 'cashflow' && <CashFlowPage h={h} sc={sc} sim={sim} />}
        {page === 'goals' && <GoalsPage h={h} base={base} plan={plan} change={change} cap={cap} goal={goal} history={history} onUndo={undo} open={open} transfer={transfer} />}
      </main>

      {drawer === 'bill' && <BillDrawer h={h} notice={notice} plan={plan} change={change} cap={cap} onCompare={() => setDrawer('compare')} onClose={() => setDrawer(null)} />}
      {drawer === 'compare' && (
        <CompareDrawer h={h} sc={sc} cap={cap} options={options} current={current}
          preview={preview} previewSim={previewSim} previewGoal={previewGoal} setPreviewId={setPreviewId}
          protectedIds={protectedIds} setProtectedIds={setProtectedIds}
          onApply={setConfirm} onClose={() => { setDrawer(null); setPreviewId(null); }} />
      )}

      {confirm && <ConfirmPlan h={h} confirm={confirm} onApply={applyOption} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

/** The most recent change, used only for the confirmation message. It never decides the plan. */
export function lastAction(history) {
  return history.length ? history[history.length - 1] : null;
}

function ConfirmPlan({ h, confirm, onApply, onCancel }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="confirm-plan-title" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 id="confirm-plan-title">Apply this plan?</h2>
        <div className="option on"><h3>{confirm.title}</h3><p>{confirm.detail}</p></div>
        {confirm.conditional
          ? <div className="alert"><b>This records an intention, not a result.</b>
              <p>Your forecast will not change until you confirm the cancellation actually went through, on the Recurring page.</p></div>
          : <div className="alert"><b>This updates your plan. It does not move money.</b>
              <p>Savings stay at {money(h.savings)} until you complete a contribution on the Goals page.</p></div>}
        <div className="row">
          <button className="btn" onClick={onApply} autoFocus><Icon n="check" s={15} />Apply</button>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
