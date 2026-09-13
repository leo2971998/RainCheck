import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useReducedMotion } from './hooks/useMotion.js';
import { useTheme } from './hooks/useTheme.js';
import { Toasts, toast } from './components/Toast.jsx';
import { useHousehold } from './hooks/useHousehold.js';
import { usePersistentState, clearPersisted, hasPersisted } from './hooks/usePersistentState.js';
import { simulate, capacity, goalPlan, dateToReach, hypothetical } from './engine/forecast.js';
import { emptyPlan, applyPatch, undoLatest, scenarioFor, householdFor } from './engine/plan.js';
import { buildOptions, currentOutcome } from './engine/options.js';
import { buildAlerts } from './engine/alerts.js';
import { migrateBillReviews, needsBillReview } from './engine/bill-reviews.js';
import { unusualCharges, answerChargePatch, chargeKey } from './engine/unusual-charges.js';
import { buildReminders } from './engine/reminders.js';
import { Icon, money, monthOf } from './components/ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ForecastPage from './pages/ForecastPage.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import RecurringPage from './pages/RecurringPage.jsx';
import CashFlowPage from './pages/CashFlowPage.jsx';
import BillDrawer from './drawers/BillDrawer.jsx';
import BillReviewDrawer from './drawers/BillReviewDrawer.jsx';
import CompareDrawer from './drawers/CompareDrawer.jsx';
import NoticeDrawer from './drawers/NoticeDrawer.jsx';
import BudgetDrawer from './drawers/BudgetDrawer.jsx';
import CheckingTargetDrawer from './drawers/CheckingTargetDrawer.jsx';
import ForecastHelpDrawer from './drawers/ForecastHelpDrawer.jsx';
import AssistantDrawer from './drawers/AssistantDrawer.jsx';
import PurchaseDrawer from './drawers/PurchaseDrawer.jsx';
import PurchasesPage from './pages/PurchasesPage.jsx';
import ChatDock, { ChatLauncher } from './components/ChatDock.jsx';
import { Ambient } from './components/Ambient.jsx';
import { forecastWeather } from './components/Weather.jsx';
import { weeklyBudget } from './engine/weekly-budget.js';
import WeeklyBudgetDrawer from './drawers/WeeklyBudgetDrawer.jsx';
import SettingsDrawer from './drawers/SettingsDrawer.jsx';
import { rainDemoPatch, RAIN_DEMO_ID } from './engine/rain-demo.js';
import { subscriptionPatch } from './engine/budget.js';
import GoalContext from './components/GoalContext.jsx';
import Drawer from './components/Drawer.jsx';

const ChatPage = lazy(() => import('./pages/ChatPage.jsx'));
const NAV = [['dashboard', 'Today', 'dash'], ['alerts', 'Alerts', 'bell'], ['forecast', 'Forecast', 'trend'], ['purchases', 'Purchases', 'cart'], ['transactions', 'Transactions', 'list', 'Activity'], ['recurring', 'Recurring', 'repeat'], ['cashflow', 'Spending & Savings', 'bars', 'Spending']];

// Goals moved onto Spending & Savings, where the budget that funds them is decided. The old id
// still resolves, so saved links, dashboard widgets and alert actions do not dead-end.
const PAGE_ALIAS = { goals: 'cashflow' };

function Navigation({ page, setPage, badges = {} }) {
  return NAV.map(([id, label, icon, short = label]) => (
    <button key={id} className={`nav nav-${id}${page === id ? ' on' : ''}`} aria-label={label + (badges[id] > 0 ? ` (${badges[id]} need attention)` : '')} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>
      <Icon n={icon} s={17} /><span className="nav-l nav-long">{label}</span><span className="nav-l nav-short" aria-hidden="true">{short}</span>
      {badges[id] > 0 && <span className="badge" aria-label={`${badges[id]} need attention`}>{badges[id]}</span>}
    </button>
  ));
}

function ThemeSwitch({ theme }) {
  return <div className="theme-switch" role="group" aria-label="Colour theme">
    {theme.MODES.map(m => <button key={m} aria-pressed={theme.mode === m} onClick={() => theme.setMode(m)}>
      {m === 'light' ? 'Light' : 'Dark'}
    </button>)}
  </div>;
}

export default function App() {
  const data = useHousehold();
  if (data.loading) return <main className="workspace"><h1>RainCheck</h1><p role="status">Loading your household…</p></main>;
  if (data.error) return <main className="workspace"><h1>Let’s reconnect your plan</h1><p role="alert">{data.error}</p><button className="btn" onClick={data.refresh}>Try again</button></main>;
  return <Workspace key={data.source} {...data} />;
}

function Workspace({ household: base, baseVersion, transactions, notice, source, purchasesAvailable = false, refresh, discovered: candidates = [], pendingNotices = [] }) {
  const [page, setPageRaw] = useState('dashboard');
  const [chatOpened, setChatOpened] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const showChat = useCallback(() => { setChatOpened(true); setChatOpen(true); }, []);
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
  const navigate = useCallback(id => { setBackTo(null); setPage(PAGE_ALIAS[id] ?? id); }, [setPage]);
  const [drawer, setDrawer] = useState(() => new URLSearchParams(window.location.search).has('review') ? 'assistant' : null);
  const [confirm, setConfirm] = useState(null);
  const [previewId, setPreviewId] = useState(null);      // an option's identity, not a snapshot of it
  const [billId, setBillId] = useState(null);            // which bill a drawer was opened for
  const [purchaseDate, setPurchaseDate] = useState(null); // date chosen from the purchase calendar
  const [noticeText, setNoticeText] = useState('');       // a notice handed to the import drawer

  // One accepted plan, plus the history that built it. Everything the user decides persists.
  const [planSaved, setPlanSaved] = usePersistentState('plan', null);
  const [history, setHistory] = usePersistentState('history', []);
  const [corrections, setCorrections] = usePersistentState('corrections', {});
  const [protectedIds, setProtectedIds] = usePersistentState('protected', { groceries: true });
  const [found, setFound] = usePersistentState('found', true);
  const [leadDays, setLeadDays] = usePersistentState('leadDays', 3);
  const [billNotes, setBillNotes] = usePersistentState('billNotes', {});

  const plan = useMemo(() => migrateBillReviews(base, planSaved ?? emptyPlan()), [base, planSaved]);
  useEffect(() => { if (planSaved && plan !== planSaved) setPlanSaved(plan); }, [plan, planSaved, setPlanSaved]);
  const h = useMemo(() => householdFor(base, plan), [base, plan]);
  const sc = useMemo(() => scenarioFor(h, plan), [h, plan]);

  const sim = useMemo(() => simulate(h, sc), [h, sc]);
  const weekly = useMemo(() => weeklyBudget(h, sc), [h, sc]);
  const cap = useMemo(() => capacity(h, sc), [h, sc]);

  // One goal plan, expressed as an amount by a date, and checked against every bill and paycheck
  // through that date rather than across one window and then multiplied.
  const goal = useMemo(() => {
    const g = goalPlan(h, sc, {
      target: h.goal.target, targetDate: h.goal.targetDate, saved: h.goal.saved,
      contribution: sc.contribution,
    });
    return {
      ...g,
      accepted: plan.goalFunding != null || plan.contribution != null,
      targetLabel: monthOf(g.targetDate),
      keepSpending: g.shared ? null : dateToReach(h, sc, { target: h.goal.target, saved: h.goal.saved, contribution: g.supported }),
    };
  }, [h, sc, plan.contribution]);

  const alerts = useMemo(() => buildAlerts(h, sc, sim, cap, lastAction(history), goal), [h, sc, sim, cap, history, goal]);
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

  // Transactions deliberately has no badge. A charge that needs a decision is an alert, and it is
  // resolved on Alerts; counting it in a second place sent people to a list that could only show
  // them the problem again. One number, one place to answer it.
  const badges = useMemo(() => ({
    recurring: h.recurring.filter(r => needsBillReview(r, sc)).length + discovered.length,
  }), [h, sc, discovered]);

  // Charges that do not fit this household: far above its own usual spending, or a merchant with
  // no history. Computed here because the test needs the full record AND the answers already
  // given, which live in the plan in this browser.
  const unusual = useMemo(() => unusualCharges(transactions, plan), [transactions, plan]);
  const unusualAlerts = useMemo(() => unusual.map(t => ({
    id: `unusual:${chargeKey(t)}`, tone: 'bad', icon: 'warn',
    amount: Math.abs(t.amt), metricLabel: plan.chargeAnswers?.[chargeKey(t)]?.answer === 'unknown' ? 'unrecognised charge' : 'charge to review',
    title: plan.chargeAnswers?.[chargeKey(t)]?.answer === 'unknown' ? `${t.what}: you marked this unrecognised.` : `${t.what}: was this you?`,
    body: t.unusual.note,
    note: 'Confirming clears the flag. Marking it unrecognised keeps it listed so you can raise it with your bank — RainCheck cannot contact them for you.',
    actions: [
      { label: 'Yes, that was me', primary: true, run: () => change(answerChargePatch(t, 'mine'), `${t.what} confirmed`) },
      { label: 'I do not recognise this', run: () => change(answerChargePatch(t, 'unknown'), `${t.what} marked unrecognised`) },
    ],
  })), [unusual, plan]);

  const [reviewedNotices, setReviewedNotices] = usePersistentState('reviewedNotices', {});
  const waiting = pendingNotices.filter(n => !reviewedNotices[n.id]);
  const allAlerts = useMemo(() => [...unusualAlerts, ...alerts], [unusualAlerts, alerts]);
  const attentionAlerts = [...allAlerts, ...waiting.map(n => ({ id: `notice:${n.id}`, tone: 'warn' }))];
  const navBadges = {
    ...badges,
    alerts: allAlerts.filter(a => a.tone !== 'good').length + waiting.length,
  };

  const open = (what, id = null, date = null) => {
    if (what.startsWith('page:')) { const id = what.slice(5); setDrawer(null); setBackTo(page === 'dashboard' ? 'dashboard' : null); setPage(PAGE_ALIAS[id] ?? id); return; }
    if (what === 'purchase') setPurchaseDate(date);
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
  const demoCost = plan.subscriptions?.[RAIN_DEMO_ID];
  const toggleRainDemo = () => {
    try {
      if (demoCost) change(subscriptionPatch(RAIN_DEMO_ID, null), 'Local rain test ended');
      else change(rainDemoPatch(base, plan, 'week'), 'Local rain test started — sample cost only');
    } catch (e) { toast.push({ title: 'Rain test not started', body: e.message, tone: 'neutral' }); }
  };

  const markPaid = r => change({ paid: { [r.billId]: r.cycle } }, `${r.label} marked paid`);
  const adopt = f => change({ adopted: { [f.id]: f } }, `${f.label} added as a commitment`);
  const dismiss = f => {
    change({ dismissed: { [f.id]: true } }, `${f.label} is not a commitment`);
    toast.push({ title: `${f.label} suggestion dismissed`, body: 'Other bill reviews stay open until you review those charges separately.', tone: 'neutral' });
  };

  const applyOption = () => {
    change(confirm.apply, confirm.apply.label);
    setConfirm(null); setDrawer(null); setPreviewId(null);
  };

  const latestDecisions = useRef({ plan, history });
  latestDecisions.current = { plan, history };
  const undo = expectedAt => {
    const latest = latestDecisions.current;
    const result = undoLatest(latest.plan, latest.history, typeof expectedAt === 'number' ? expectedAt : null);
    if (!result) {
      if (typeof expectedAt === 'number') toast.push({ title: 'That change is no longer the latest', body: 'Undo the most recent change first.', tone: 'neutral' });
      return;
    }
    latestDecisions.current = result;
    setPlanSaved(result.plan);
    setHistory(result.history);
  };

  const resetAll = () => { clearPersisted(); window.location.reload(); };

  // A plan change reports its consequence in one line, with Undo beside it. The figures come from
  // this render, so the toast can never disagree with the cards it summarises.
  const seen = useRef(lastAction(history)?.at ?? 0);
  const before = useRef({ cap, gap: goal.gap, low: sim.low.balance });
  useEffect(() => {
    const entry = lastAction(history);
    const grew = entry && entry.at > seen.current;
    seen.current = Math.max(seen.current, entry?.at ?? 0);
    const prev = before.current;
    before.current = { cap, gap: goal.gap, low: sim.low.balance };
    if (!grew) return;
    const parts = [];
    if (cap !== prev.cap) parts.push(`plan carries ${money(prev.cap)} → ${money(cap)}`);
    if (goal.gap !== prev.gap) parts.push(goal.gap ? `goal ${money(goal.gap)} short` : 'goal back on track');
    if (sim.low.balance !== prev.low) parts.push(`lowest balance ${money(sim.low.balance)}`);
    const worse = goal.gap > prev.gap || sim.low.balance < prev.low || cap < prev.cap;
    toast.push({ title: entry.label, body: parts.length ? parts.join(' · ') : 'Forecast unchanged',
      tone: worse ? 'warn' : 'good', ttl: 9000, actions: [{ label: 'Undo', run: () => undo(entry.at) }] });
  }, [history]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Bills due soon are announced once per session. The reminder card stays; this is the nudge.
  useEffect(() => {
    if (!reminders.length) return;
    try { if (sessionStorage.getItem('raincheck:reminded')) return; sessionStorage.setItem('raincheck:reminded', '1'); } catch { /* private mode */ }
    reminders.slice(0, 3).forEach((r, i) => setTimeout(() => toast.push({
      title: `${r.label} charges ${r.when}`, body: money(r.amount), tone: 'neutral', ttl: 9000,
      actions: [{ label: 'Mark paid', run: () => markPaid(r) }],
    }), 900 + i * 350));
  }, [reminders.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  const chatVisible = chatOpen && !drawer && !confirm;

  return (
    <div className={`app${chatVisible ? ' chat-is-open' : ''}`}>
      <Ambient state={forecastWeather(page === 'dashboard' ? weekly.state : sim.worst, attentionAlerts)} />
      <aside>
        <div className="brand"><span className="mark"><span className="weather-mark" aria-hidden="true">☂</span></span><div><b>RainCheck</b><small>Financial forecast</small></div></div>
        <nav aria-label="Main navigation"><Navigation page={page} setPage={navigate} badges={navBadges} /></nav>
        <div className="side-foot">
          <div className="acct"><span className="avatar">AR</span><span>Alex Rivera</span></div>
          <button className="link settings-entry" onClick={() => setDrawer('settings')}><Icon n="gear" s={15} />Settings</button>
          <ThemeSwitch theme={theme} />
        </div>
      </aside>

      <main className="workspace">
        <div className="mobile-tools">
          <div><b>RainCheck</b><button className="link settings-entry" onClick={() => setDrawer('settings')}><Icon n="gear" s={15} />Settings</button></div>
          <ThemeSwitch theme={theme} />
        </div>
        <nav className="tabs" aria-label="Section navigation"><Navigation page={page} setPage={navigate} badges={navBadges} /></nav>
        {backTo && page !== backTo && <button className="back-link" onClick={() => navigate(backTo)}><i className="back-ic"><Icon n="arrow" s={14} /></i>Back to Today</button>}
        <GoalContext page={page} h={h} goal={goal} open={open} />
        {page === 'dashboard' && <Dashboard h={h} sc={sc} weekly={weekly} alerts={attentionAlerts} open={open} history={history} onUndo={undo} dark={theme.dark} />}
        {page === 'alerts' && <AlertsPage h={h} sc={sc} alerts={allAlerts} reminders={reminders} leadDays={leadDays} setLeadDays={setLeadDays} onPaid={markPaid} waiting={waiting} onReviewNotice={reviewNoticeItem} open={open} />}
        {page === 'forecast' && <ForecastPage h={h} sc={sc} plan={plan} change={change} sim={sim} cap={cap} goal={goal} open={open} />}
        {page === 'purchases' && <PurchasesPage h={h} available={purchasesAvailable} open={open} refresh={refresh} />}
        {page === 'transactions' && <TransactionsPage transactions={transactions} allowances={h.allowances} h={h} sc={sc} unusual={unusual} corrections={corrections} setCorrections={setCorrections} open={open} />}
        {page === 'recurring' && <RecurringPage h={h} sc={sc} plan={plan} change={change} cap={cap} open={open} discovered={discovered} onAdopt={adopt} onDismiss={dismiss} billNotes={billNotes} />}
        {page === 'cashflow' && <CashFlowPage base={base} baseVersion={baseVersion} h={h} sc={sc} plan={plan} goal={goal} protectedIds={protectedIds} setProtectedIds={setProtectedIds} change={change} open={open} history={history} onUndo={undo} />}
      </main>

      {!chatVisible && !drawer && !confirm && <ChatLauncher onOpen={showChat} />}
      {chatOpened && <ChatDock open={chatVisible} onClose={() => setChatOpen(false)}><Suspense fallback={<p role="status" style={{ padding: 24 }}>Opening chat…</p>}><ChatPage baseVersion={baseVersion} plan={plan} visible={chatVisible} /></Suspense></ChatDock>}

      <Toasts />
      {drawer === 'settings' && <SettingsDrawer demoCost={demoCost} onToggleRain={toggleRainDemo} hasDecisions={hasPersisted()} onReset={resetAll} onClose={() => setDrawer(null)} />}
      {drawer === 'week-budget' && <WeeklyBudgetDrawer h={h} weekly={weekly} open={open} onClose={() => setDrawer(null)} />}
      {drawer === 'checking-target' && <CheckingTargetDrawer h={h} sim={sim} change={change} onClose={() => setDrawer(null)} />}
      {drawer === 'forecast-help' && <ForecastHelpDrawer h={h} sc={sc} sim={sim} options={options} current={current}
        baseVersion={baseVersion} plan={plan} open={open} onClose={() => setDrawer(null)} />}
      {drawer === 'anomaly' && <BillReviewDrawer id={billId} h={h} plan={plan} notes={billNotes} change={change}
        saveNote={(key,text) => setBillNotes(previous => ({ ...previous, [key]: text }))} onClose={() => setDrawer(null)} />}
      {drawer === 'assistant' && <AssistantDrawer baseVersion={baseVersion} plan={plan} savedId={new URLSearchParams(window.location.search).get('review')} onClose={() => setDrawer(null)} />}
      {drawer === 'purchase' && purchasesAvailable && <PurchaseDrawer key={`${billId}:${purchaseDate}:${baseVersion}:${JSON.stringify(plan)}`} id={billId} initialDate={purchaseDate} base={base} baseVersion={baseVersion} plan={plan} refresh={refresh}
        onOpenAlerts={() => navigate('alerts')} onClose={() => { setDrawer(null); setPurchaseDate(null); }} />}
      {(drawer === 'goal' || drawer === 'subscription') && <BudgetDrawer key={`${drawer}:${billId}`} kind={drawer} id={billId} base={base} baseVersion={baseVersion} plan={plan} change={change} onClose={() => setDrawer(null)} />}
      {drawer === 'bill' && <BillDrawer h={h} billId={billId} plan={plan} change={change} cap={cap} notes={billNotes}
        saveNote={(key,text) => setBillNotes(previous => ({ ...previous, [key]: text }))} onCompare={() => setDrawer('compare')} onClose={() => setDrawer(null)} />}
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
  return (
    <Drawer variant="modal" label="Apply this plan?" onClose={onCancel}>
        <h2 id="confirm-plan-title">Apply this plan?</h2>
        <div className="option on"><h3>{confirm.title}</h3><p>{confirm.detail}</p></div>
        {confirm.conditional
          ? <div className="alert"><b>This records an intention, not a result.</b>
              <p>Your forecast will not change until you confirm the cancellation actually went through, on the Recurring page.</p></div>
          : <div className="alert"><b>This updates your plan. It does not move money.</b>
              <p>Your saved balance stays at {money(h.savings)}.</p></div>}
        <div className="row">
          <button className="btn" onClick={onApply}><Icon n="check" s={15} />Apply</button>
          <button className="btn ghost" onClick={onCancel} data-initial-focus>Cancel</button>
        </div>
    </Drawer>
  );
}
