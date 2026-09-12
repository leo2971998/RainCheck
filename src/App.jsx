import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useReducedMotion } from './hooks/useMotion.js';
import { useTheme } from './hooks/useTheme.js';
import { Ambient } from './components/Ambient.jsx';
import { Toasts, toast } from './components/Toast.jsx';
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
import AlertsPage from './pages/AlertsPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import RecurringPage from './pages/RecurringPage.jsx';
import CashFlowPage from './pages/CashFlowPage.jsx';
import GoalsPage from './pages/GoalsPage.jsx';
import BillDrawer from './drawers/BillDrawer.jsx';
import CompareDrawer from './drawers/CompareDrawer.jsx';
import NoticeDrawer from './drawers/NoticeDrawer.jsx';

const NAV = [['dashboard', 'Today', 'dash'], ['alerts', 'Alerts', 'bell'], ['forecast', 'Forecast', 'trend'], ['transactions', 'Transactions', 'list', 'Activity'], ['recurring', 'Recurring', 'repeat'], ['cashflow', 'Cash flow', 'bars'], ['goals', 'Goals', 'target']];

function Navigation({ page, setPage, badges = {} }) {
  return NAV.map(([id, label, icon, short = label]) => (
    <button key={id} className={`nav${page === id ? ' on' : ''}`} aria-label={label + (badges[id] > 0 ? ` (${badges[id]} need attention)` : '')} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>
      <Icon n={icon} s={17} /><span className="nav-l nav-long">{label}</span><span className="nav-l nav-short" aria-hidden="true">{short}</span>
      {badges[id] > 0 && <span className="badge" aria-label={`${badges[id]} need attention`}>{badges[id]}</span>}
    </button>
  ));
}

function ThemeSwitch({ theme }) {
  return <div className="theme-switch" role="group" aria-label="Colour theme">
    {theme.MODES.map(m => <button key={m} aria-pressed={theme.mode === m} onClick={() => theme.setMode(m)}>
      {m === 'auto' ? 'Auto' : m === 'light' ? 'Light' : 'Dark'}
    </button>)}
  </div>;
}

export default function App() {
  const data = useHousehold();
  if (data.loading) return <main className="workspace"><h1>RainCheck</h1><p role="status">Loading your household…</p></main>;
  return <Workspace key={data.source} {...data} />;
}

function Workspace({ household: base, transactions, notice, source, discovered: candidates = [], pendingNotices = [] }) {
  const [page, setPageRaw] = useState('dashboard');
  const reducedMotion = useReducedMotion();
  const theme = useTheme();

  /**
   * Cross-fade between sections where the browser supports it.
   *
   * Navigation is the one path a demo cannot afford to break, so every failure mode — no View
   * Transitions API, a reader who asked for reduced motion, an exception inside the callback —
   * falls through to an ordinary state change.
   */
  const setPage = useCallback(next => {
    let ran = false;
    const go = () => { if (ran) return; ran = true; setPageRaw(next); };
    if (reducedMotion || typeof document.startViewTransition !== 'function') return go();

    // startViewTransition defers its callback until the browser has a rendering opportunity to
    // snapshot from. When one is slow to arrive — a throttled tab, a screen-share, an embedded
    // view — that callback can be seconds late or never run, and the page simply does not change.
    // Observed in the wild: one navigation stranded for over six seconds. The cross-fade is worth
    // far less than a section that always opens, so a watchdog commits the change regardless and
    // drops the transition rather than letting it arrive on top of a page that already moved.
    let vt = null;
    const watchdog = setTimeout(() => { go(); vt?.skipTransition?.(); }, 120);
    try {
      vt = document.startViewTransition(() => { clearTimeout(watchdog); flushSync(go); });
      // A skipped or superseded transition rejects all three of its promises. Skipping is the
      // intended outcome here, not a failure, so it must not surface as an uncaught rejection.
      for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p?.catch?.(() => {});
    } catch { clearTimeout(watchdog); go(); }
  }, [reducedMotion]);
  const [backTo, setBackTo] = useState(null);
  const navigate = useCallback(id => { setBackTo(null); setPage(id); }, [setPage]);
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
  const navBadges = { ...badges, alerts: alerts.filter(a => a.tone !== 'good').length + reminders.length + waiting.length };

  const open = (what, id = null) => {
    if (what.startsWith('page:')) { setDrawer(null); setBackTo(page === 'dashboard' ? 'dashboard' : null); setPage(what.slice(5)); return; }
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

  // A plan change reports its consequence in one line, with Undo beside it. The figures come from
  // this render, so the toast can never disagree with the cards it summarises.
  const seen = useRef(history.length);
  const before = useRef({ cap, gap: goal.gap, low: sim.low.balance });
  useEffect(() => {
    const grew = history.length > seen.current;
    seen.current = history.length;
    const prev = before.current;
    before.current = { cap, gap: goal.gap, low: sim.low.balance };
    if (!grew) return;
    const entry = history[history.length - 1];
    const parts = [];
    if (cap !== prev.cap) parts.push(`plan carries ${money(prev.cap)} → ${money(cap)}`);
    if (goal.gap !== prev.gap) parts.push(goal.gap ? `goal ${money(goal.gap)} short` : 'goal back on track');
    if (sim.low.balance !== prev.low) parts.push(`lowest balance ${money(sim.low.balance)}`);
    const worse = goal.gap > prev.gap || sim.low.balance < prev.low || cap < prev.cap;
    toast.push({ title: entry.label, body: parts.length ? parts.join(' · ') : 'Forecast unchanged',
      tone: worse ? 'warn' : 'good', ttl: 9000, actions: [{ label: 'Undo', run: undo }] });
  }, [history.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Bills due soon are announced once per session. The reminder card stays; this is the nudge.
  useEffect(() => {
    if (!reminders.length) return;
    try { if (sessionStorage.getItem('raincheck:reminded')) return; sessionStorage.setItem('raincheck:reminded', '1'); } catch { /* private mode */ }
    reminders.slice(0, 3).forEach((r, i) => setTimeout(() => toast.push({
      title: `${r.label} charges ${r.when}`, body: money(r.amount), tone: 'neutral', ttl: 9000,
      actions: [{ label: 'Mark paid', run: () => markPaid(r) }],
    }), 900 + i * 350));
  }, [reminders.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  const sourceLabel = source === 'nessie' ? 'Nessie sandbox' : source === 'snapshot' ? 'Saved sandbox snapshot' : 'Sample data';

  return (
    <div className="app">
      <aside>
        <div className="brand"><span className="mark"><span className="weather-mark" aria-hidden="true">☂</span></span><div><b>RainCheck</b><small>Financial forecast</small></div></div>
        <nav aria-label="Main navigation"><Navigation page={page} setPage={navigate} badges={navBadges} /></nav>
        <div className="side-foot">
          <div className="acct"><span className="avatar">AR</span><span>Alex Rivera</span></div>
          Everyday Checking · Savings<br />{sourceLabel}
          <ThemeSwitch theme={theme} />
          {hasPersisted() && <><br /><button className="link" style={{ fontSize: 12, marginTop: 6 }} onClick={resetAll}>Reset my decisions</button></>}
        </div>
      </aside>

      <main className="workspace">
        <div className="mobile-tools">
          <div><b>RainCheck</b>{hasPersisted() && <button className="link" onClick={resetAll} title="Clear local decisions only. Bank records do not change.">Reset demo</button>}</div>
          <ThemeSwitch theme={theme} />
        </div>
        <nav className="tabs" aria-label="Section navigation"><Navigation page={page} setPage={navigate} badges={navBadges} /></nav>
        {backTo && page !== backTo && <button className="back-link" onClick={() => navigate(backTo)}><i className="back-ic"><Icon n="arrow" s={14} /></i>Back to Today</button>}
        {page === 'dashboard' && <Dashboard h={h} source={source} dark={theme.dark} plan={plan} sc={sc} change={change} sim={sim} previewSim={previewSim} preview={preview} cap={cap} goal={goal} alerts={alerts} waiting={waiting} onReviewNotice={reviewNoticeItem} reminders={reminders} leadDays={leadDays} setLeadDays={setLeadDays} onPaid={markPaid} open={open} history={history} onUndo={undo} found={found} setFound={setFound} />}
        {page === 'alerts' && <AlertsPage h={h} alerts={alerts} reminders={reminders} leadDays={leadDays} setLeadDays={setLeadDays} onPaid={markPaid} waiting={waiting} onReviewNotice={reviewNoticeItem} open={open} found={found} setFound={setFound} />}
        {page === 'forecast' && <ForecastPage h={h} sc={sc} plan={plan} change={change} sim={sim} cap={cap} goal={goal} />}
        {page === 'transactions' && <TransactionsPage transactions={transactions} allowances={h.allowances} corrections={corrections} setCorrections={setCorrections} />}
        {page === 'recurring' && <RecurringPage h={h} sc={sc} plan={plan} change={change} cap={cap} open={open} discovered={discovered} onAdopt={adopt} onDismiss={dismiss} />}
        {page === 'cashflow' && <CashFlowPage h={h} sc={sc} sim={sim} />}
        {page === 'goals' && <GoalsPage h={h} base={base} plan={plan} change={change} cap={cap} goal={goal} history={history} onUndo={undo} open={open} transfer={transfer} />}
      </main>

      <Ambient state={sim.worst} />
      <Toasts />
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
