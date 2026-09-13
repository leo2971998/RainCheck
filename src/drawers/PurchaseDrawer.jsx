import { useState } from 'react';
import Drawer, { DrawerHeader } from '../components/Drawer.jsx';
import BudgetImpact, { budgetMoney, budgetDate } from '../components/BudgetImpact.jsx';
import PurchaseSteps from '../components/PurchaseSteps.jsx';
import ReviewPanel from '../components/ReviewPanel.jsx';
import { purchaseImpact } from '../engine/purchase-impact.js';
import { readPurchase, purchaseSchedule, withPurchase } from '../engine/purchases.js';
import { householdFor, scenarioFor } from '../engine/plan.js';
import { budgetStatus } from '../engine/review-status.js';
import { toast } from '../components/Toast.jsx';

const monthName = iso => new Date(`${iso.slice(0, 7)}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export function purchaseSaveToast({ matching = false, removing = false, editing = false, status, previewMonth, onOpenAlerts }) {
  if (matching) return { title: 'Purchase completed', body: 'Matched to a posted charge. The future estimate is no longer counted.', tone: 'neutral', actions: [] };
  if (removing) return { title: 'Purchase removed from the plan', body: 'The estimate no longer affects your forecast.', tone: 'neutral', actions: [] };
  if (status?.tone === 'warn' || status?.tone === 'bad') return {
    title: `${previewMonth} budget alert added`,
    body: 'This purchase puts the current plan under pressure. Review the alert to adjust the purchase or compare another plan.',
    tone: status.tone,
    actions: onOpenAlerts ? [{ label: 'Review alert', run: onOpenAlerts }] : [],
  };
  return { title: editing ? 'Purchase updated' : `Added to ${previewMonth}`, body: 'The purchase is now included in that month’s plan.', tone: 'good', actions: [] };
}

export default function PurchaseDrawer({ id, initialDate, base, baseVersion, plan, refresh, onOpenAlerts, onClose }) {
  const existing = base.plannedPurchases?.find(p => p.id === id);
  const [itemId] = useState(() => id || crypto.randomUUID());
  const [draft, setDraft] = useState(() => existing || { label: '', amount: '', date: initialDate || base.today, accountId: base.checkingId, allowanceId: '' });
  const [preview, setPreview] = useState(null), [matches, setMatches] = useState(null), [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const close = () => { if (!busy) onClose(); };
  const update = e => { setDraft(d => ({ ...d, [e.target.name]: e.target.value })); setError(''); };
  const title = existing ? 'Review purchase' : 'Plan a purchase';
  const showPreview = (e, remove = false) => {
    e?.preventDefault();
    try {
      const patch = remove ? { id, remove: true } : { ...(id ? { id } : {}), draft: readPurchase(draft, base) };
      const next = householdFor(withPurchase(base, patch.draft, id, remove), plan);
      const allocation = purchaseSchedule(next, scenarioFor(next, plan)).allocations[id || 'preview'];
      setPreview({ patch, impact: purchaseImpact(base, plan, patch), allocation, remove }); setError('');
    } catch(e) { setError(e.message); }
  };
  const save = async (action = 'save') => {
    if (busy) return; setBusy(true); setError('');
    try {
      const matching = action === 'match', removing = preview?.remove;
      const response = await fetch('/api/purchases', { method: matching ? 'POST' : removing ? 'DELETE' : existing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ id: itemId, revision: existing?.revision || 0, baseVersion,
          ...(matching ? { action: 'match', transactionId: selected, confirmed: true } : { draft: preview?.patch.draft }) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      if (await refresh()) {
        toast.push(purchaseSaveToast({ matching, removing, editing: Boolean(existing), status, previewMonth, onOpenAlerts }));
        onClose();
      }
    } catch(e) { setError(e.name === 'TimeoutError' || e instanceof TypeError ? 'The save could not be confirmed. Refresh purchases before trying again.' : e.message); }
    finally { setBusy(false); }
  };
  const findMatches = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/purchases?candidates=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(20000) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      if (result.baseVersion !== baseVersion) throw new Error('Bank data or saved plans changed. Refresh purchases first.');
      setMatches(result.candidates); setSelected('');
    } catch { setError('We couldn’t check for matching charges. Refresh purchases and try again.'); }
    finally { setBusy(false); }
  };
  const status = preview && budgetStatus(preview.impact.after, base.cushion);
  const previewMonth = preview && monthName(preview.remove ? existing.date : preview.patch.draft.date);
  return <Drawer label={title} onClose={close} className="purchase-drawer"><DrawerHeader title={title} icon="cart" onClose={close} />
    <p>Add a one-time cost and see its effect on checking before you save it.</p>
    {!matches && <PurchaseSteps compact current={preview ? 2 : 1} />}
    {!preview && !matches && <>
      <form className="budget-form" onSubmit={showPreview}>
        <label>What are you planning?<input name="label" value={draft.label} onChange={update} maxLength={100} required placeholder="e.g. Concert tickets" disabled={busy} /></label>
        <div className="purchase-form-pair"><label>Estimated cost ($)<input name="amount" type="number" min="0.01" max="100000" step="0.01" inputMode="decimal" required value={draft.amount} onChange={update} disabled={busy} /></label>
          <label>Purchase date<input name="date" type="date" value={draft.date} required onChange={update} disabled={busy} /></label></div>
        <label>How should we count it?<select name="allowanceId" value={draft.allowanceId || ''} onChange={update} disabled={busy}>
          <option value="">Extra spending — not in my usual budget</option>{base.allowances.map(a => <option key={a.id} value={a.id}>Use my {a.label.toLowerCase()} allowance</option>)}
        </select></label>
        <p className="fine">Using an allowance moves that spending to this date. Any amount above the remaining allowance counts as extra.</p>
        <button className="btn" disabled={busy} type="submit">Preview impact</button>
      </form>
      {existing && <div className="purchase-secondary"><button className="btn ghost" onClick={findMatches} disabled={busy}>Find a posted charge</button>
        <button className="link budget-remove" onClick={() => showPreview(null, true)} disabled={busy}>Remove planned purchase</button>
        <p className="fine">Matching uses your last saved purchase details, not unsaved edits above.</p></div>}
    </>}
    {preview && <>
      <section className={`purchase-preview-head ${status.tone}`}>
        <div><span className="review-eyebrow">Step 2 · Calculated plan check</span><span className={`pill ${status.tone}`}>{status.label}</span></div>
        <h3>{preview.remove ? `Remove ${existing.label}?` : `${preview.patch.draft.label} · ${budgetMoney(preview.patch.draft.amount)}`}</h3>
        <p>{preview.remove ? `This estimate will leave the ${previewMonth} plan. No order is cancelled; history is kept.` : `Planned for ${budgetDate(preview.patch.draft.date)} and included in the ${previewMonth} plan.`}</p>
      </section>
      {preview.allocation && <p className="purchase-coverage">{preview.allocation.covered > 0
        ? `${budgetMoney(preview.allocation.covered)} comes from the existing allowance. ${budgetMoney(preview.allocation.extra)} is extra spending.` : 'Counted once as extra spending.'}</p>}
      <section className={`purchase-month-check ${status.tone}`} aria-label={`${previewMonth} alert check`}>
        <span className="purchase-month-icon" aria-hidden="true">{status.tone === 'good' ? '✓' : '!'}</span>
        <div><span className="review-eyebrow">{previewMonth} · Alert check</span>
          <h3>{status.tone === 'good' ? 'No budget warning from this preview' : `This month’s plan needs attention`}</h3>
          <p>{status.tone === 'good'
            ? 'The current calculation stays within your checking cushion and savings plan. Saving still adds the purchase to this month.'
            : 'If you save this purchase, RainCheck will add a calculated warning to Alerts. You can adjust the cost or date before saving.'}</p></div>
      </section>
      <section className="purchase-week" aria-label="Purchase week impact"><span className="review-eyebrow">That week · {budgetDate(preview.impact.week.startsOn)}–{budgetDate(preview.impact.week.endsOn)}</span>
        <h3>Lowest checking balance</h3><div><span>Now <b>{budgetMoney(preview.impact.week.beforeLow)}</b></span><span aria-hidden="true">→</span><span>Preview <b>{budgetMoney(preview.impact.week.afterLow)}</b></span></div>
        <p className="fine">End-of-day estimate. Your checking cushion is {budgetMoney(base.cushion)}.</p></section>
      <BudgetImpact impact={preview.impact} />
      <section className="purchase-ai-card">
        <div className="purchase-decision-number" aria-hidden="true">3</div><div><span className="review-eyebrow">Optional explanation</span><h3>Review the plan with AI</h3>
          <p>AI can explain the calculator’s result and point out assumptions.</p></div>
        <details className="budget-ai-review"><summary>Open AI review</summary><ReviewPanel baseVersion={baseVersion} plan={plan} patch={preview.patch} kind="purchase" /></details>
      </section>
      <section className="purchase-save-card">
        <div className="purchase-decision-number" aria-hidden="true">4</div><div><span className="review-eyebrow">Your decision</span><h3>{preview.remove ? 'Remove this estimate?' : `Add this to ${previewMonth}?`}</h3>
          <p>{preview.remove ? 'Its history stays available, but it stops affecting the forecast.' : 'Saving updates your plan and any related alerts.'}</p></div>
        <div className="row wrap budget-actions"><button className="btn" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : preview.remove ? 'Confirm removal' : 'Save purchase'}</button>
          <button className="btn ghost" disabled={busy} onClick={() => setPreview(null)}>Back to details</button></div>
      </section>
    </>}
    {matches && <section aria-label="Match a posted charge"><h3>Is one of these your purchase?</h3>
      <p>We look for a similar purchase description, an amount within 10% (or $1), and a date within 7 days. Only posted checking purchases qualify.</p>
      {matches.length ? <fieldset className="purchase-matches"><legend>Choose the actual charge</legend>{matches.map(t => <label key={t.id}><input type="radio" name="charge" value={t.id} checked={selected === t.id} onChange={() => setSelected(t.id)} disabled={busy} />
        <span><b>{t.description} · {budgetMoney(-t.amount)}</b><small>{budgetDate(t.date)} · Posted</small></span></label>)}</fieldset>
        : <p className="alert">No close posted charge found. Your purchase stays planned. If the purchase name, estimate or date is wrong, edit and save those details first.</p>}
      {selected && <p className="alert">Confirming completes this plan. The actual charge is already in your bank balance, so the future estimate is removed. We keep both linked in history; no bank transaction is edited.</p>}
      <div className="row wrap budget-actions"><button className="btn" disabled={!selected || busy} onClick={() => save('match')}>{busy ? 'Confirming…' : 'Confirm this is the purchase'}</button>
        <button className="btn ghost" disabled={busy} onClick={() => setMatches(null)}>Back to details</button></div>
    </section>}
    {busy && <p role="status">Checking and saving your plans…</p>}
    {error && <div className="alert" role="alert"><p>{error}</p><button className="btn ghost sm" onClick={refresh} disabled={busy}>Refresh purchases</button></div>}
  </Drawer>;
}
