import { useEffect, useMemo, useState } from 'react';
import { useHousehold } from './hooks/useHousehold.js';
import { useTransfer } from './hooks/useTransfer.js';
import { usePersistentState, clearPersisted, hasPersisted } from './hooks/usePersistentState.js';
import { simulate, capacity, goalPlan, dateToReach, hypothetical } from './engine/forecast.js';
import { emptyPlan, applyPatch, revert, scenarioFor, householdFor } from './engine/plan.js';
import { buildOptions, currentOutcome } from './engine/options.js';
import { buildAlerts } from './engine/alerts.js';
import { buildReminders } from './engine/reminders.js';
import { Icon, money, monthOf } from './components/ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ForecastPage from './pages/ForecastPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import RecurringPage from './pages/RecurringPage.jsx';
import CashFlowPage from './pages/CashFlowPage.jsx';
import GoalsPage from './pages/GoalsPage.jsx';
import BillDrawer from './drawers/BillDrawer.jsx';
import CompareDrawer from './drawers/CompareDrawer.jsx';
import NoticeDrawer from './drawers/NoticeDrawer.jsx';

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

function Workspace({ household: base, transactions, notice, source, discovered: candidates = [], pendingNotices = [] }) {
  const [page, setPage] = useState('dashboard');
  const [drawer, setDrawer] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [previewId, setPreviewId] = useState(null);      // an option's identity, not a snapshot of it
  const [billId, setBillId] = useState(null);            // which bill a drawer was opened for
  const [noticeText, setNoticeText] = useState('');       // a notice handed to the import drawer

  // One accepted plan, plus the history that built it. Everything the user decides persists.
  const [planSaved, setPlanSaved] = usePersistentState('plan', null);
  const [history, setHistory] = usePersistentState('history', []);
  const [corrections, setCorrections] = usePersistentState('corrections', {});
  const [protectedIds, setProtectedIds] = usePersistentState('protected', { groceries: true });
  const [found, setFound] = usePersistentState('found', true);
  const [leadDays, setLeadDays] = usePersistentState('leadDays', 3);

  const plan = planSaved ?? emptyPlan();
  const h = useMemo(() => householdFor(base, plan), [base, plan]);
  const sc = useMemo(() => scenarioFor(h, plan), [h, plan]);

  const sim = useMemo(() => simulate(h, sc), [h, sc]);
  const cap = useMemo(() => capacity(h, sc), [h, sc]);

  // One goal plan, expressed as an amount by a date, and checked against every bill and paycheck
  // through that date rather than across one window and then multiplied.
  const goal = useMemo(() => {
    const g = goalPlan(h, sc, {
      target: h.goal.target, targetDate: h.goal.targetDate, saved: h.goal.saved,
      contribution: plan.contribution,
    });
    return {
      ...g,
      accepted: plan.contribution != null,
      targetLabel: monthOf(g.targetDate),
      keepSpending: dateToReach(h, sc, { target: h.goal.target, saved: h.goal.saved, contribution: g.supported }),
    };
  }, [h, sc, plan.contribution]);

  const alerts = useMemo(() => buildAlerts(h, sc, sim, cap, lastAction(history)), [h, sc, sim, cap, history]);
  const options = useMemo(() => buildOptions(h, sc, cap, protectedIds), [h, sc, cap, protectedIds]);
  const current = useMemo(() => currentOutcome(h, sc), [h, sc]);
  const reminders = useMemo(() => buildReminders(h, sc, leadDays), [h, sc, leadDays]);

  // Proposals only, and always from whichever records built this household. Anything the user has
  // already adopted or rejected drops out of the list.
  const discovered = useMemo(
    () => candidates.filter(f => !plan.adopted?.[f.id] && !plan.dismissed?.[f.id] && !h.recurring.some(r => r.id === f.id)),
    [candidates, plan, h]);

  // The preview always describes the option as it stands NOW. Protecting an allowance can replace
  // the trim option with a different category; the preview must follow, not describe the old one.
  const preview = useMemo(() => options.find(o => o.id === previewId && !o.disabled) ?? null, [options, previewId]);
  useEffect(() => { if (previewId && !preview) setPreviewId(null); }, [previewId, preview]);

  const previewSim = useMemo(() => (preview ? simulate(h, hypothetical(sc, preview.apply)) : null), [h, sc, preview]);
  const previewGoal = useMemo(() => (preview ? goalPlan(h, sc, { target: h.goal.target, targetDate: h.goal.targetDate, saved: h.goal.saved, contribution: preview.outcome.contribution }) : null), [h, sc, preview]);

  const badges = useMemo(() => ({
    recurring: h.recurring.filter(r => r.change || (r.unexplained && !(r.id in (plan.treatAsNewPrice || {})))).length,
    transactions: transactions.filter(t => t.note).length,
  }), [h, transactions, plan]);

  const transfer = useTransfer(source);
  const [reviewedNotices, setReviewedNotices] = usePersistentState('reviewedNotices', {});
  const waiting = pendingNotices.filter(n => !reviewedNotices[n.id]);

  const open = (what, id = null) => {
    if (what.startsWith('page:')) { setDrawer(null); setPage(what.slice(5)); return; }
    setBillId(id); setDrawer(what);
  };
  const reviewNoticeItem = item => { setNoticeText(item?.text || ''); setBillId(item?.id || null); setDrawer('notice'); };
  const markNoticeReviewed = id => id && setReviewedNotices(r => ({ ...r, [id]: true }));

  /** Every change goes through here, so each one can be reversed on its own. */
  const change = (patch, label) => {
    const { plan: next, entry } = applyPatch(plan, patch, label ?? patch.label ?? 'Plan updated');
    setPlanSaved(next);
    setHistory(hs => [...hs, entry].slice(-20));
  };

  const markPaid = r => change({ paid: { [r.billId]: r.cycle } }, `${r.label} marked paid`);
  const adopt = f => change({ adopted: { [f.id]: f } }, `${f.label} added as a commitment`);
  const dismiss = f => change({ dismissed: { [f.id]: true } }, `${f.label} is not a commitment`);

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
        {page === 'dashboard' && <Dashboard h={h} source={source} plan={plan} sc={sc} change={change} sim={sim} previewSim={previewSim} preview={preview} cap={cap} goal={goal} alerts={alerts} waiting={waiting} onReviewNotice={reviewNoticeItem} reminders={reminders} leadDays={leadDays} setLeadDays={setLeadDays} onPaid={markPaid} open={open} history={history} onUndo={undo} found={found} setFound={setFound} />}
        {page === 'forecast' && <ForecastPage h={h} sc={sc} plan={plan} change={change} sim={sim} cap={cap} goal={goal} />}
        {page === 'transactions' && <TransactionsPage transactions={transactions} allowances={h.allowances} corrections={corrections} setCorrections={setCorrections} />}
        {page === 'recurring' && <RecurringPage h={h} sc={sc} plan={plan} change={change} cap={cap} open={open} discovered={discovered} onAdopt={adopt} onDismiss={dismiss} />}
        {page === 'cashflow' && <CashFlowPage h={h} sc={sc} sim={sim} />}
        {page === 'goals' && <GoalsPage h={h} base={base} plan={plan} change={change} cap={cap} goal={goal} history={history} onUndo={undo} open={open} transfer={transfer} />}
      </main>

      {drawer === 'bill' && <BillDrawer h={h} notice={notice} billId={billId} plan={plan} change={change} cap={cap} onCompare={() => setDrawer('compare')} onClose={() => setDrawer(null)} />}
      {drawer === 'notice' && <NoticeDrawer h={h} base={base} plan={plan} cap={cap} change={change}
        initialText={noticeText} origin={waiting.find(n => n.id === billId)}
        onDone={() => markNoticeReviewed(billId)} onClose={() => { setDrawer(null); setNoticeText(''); }} />}
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
