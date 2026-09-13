import { useEffect, useRef, useState } from 'react';
import { budgetMoney, budgetDate } from './BudgetImpact.jsx';
import { budgetStatus } from '../engine/review-status.js';

const factNames = { lowCents: 'Checking forecast', monthlyBillsCents: 'Monthly bills', contributionCents: 'Planned saving',
  plannedPurchasesCents: 'One-time purchases', beforeLowCents: 'Purchase-week forecast', afterLowCents: 'Purchase-week forecast',
  goalTargetCents: 'Savings target', goalProjectedCents: 'Goal projection', contributionFits: 'Cushion check',
  goalFeasible: 'Goal feasibility', checkedThrough: 'Goal horizon', goalDate: 'Goal deadline',
  cushionCents: 'Checking cushion', windowDays: 'Forecast window', asOf: 'Data date' };
const sourceName = path => path.startsWith('evidence.') ? 'Supporting evidence' : factNames[path.split('.').at(-1)] || 'Calculator';

export function ReviewAnswer({ review, retrieval, impact, historical = false, compact = false }) {
  const f = review.facts, a = f.after;
  const shared = impact?.after?.shared;
  const status = budgetStatus({ low: a.lowCents / 100, fits: a.contributionFits,
    gap: Math.max(0, a.goalTargetCents - a.goalProjectedCents) / 100 }, f.cushionCents / 100);
  const evidence = retrieval?.evidence || f.evidence || [];
  return <article className="review-answer">
    {historical && <p className="alert">Saved review — this describes an earlier plan, not necessarily your current decisions.</p>}
    {!compact && <div className="review-calculation">
      <span className="review-eyebrow">From the calculator · {budgetDate(f.asOf)}</span>
      <h3>{status.label}</h3>
      <dl className="review-numbers">
        <div><dt>Lowest checking · {f.windowDays} days</dt><dd>{budgetMoney(a.lowCents / 100)}</dd></div>
        <div><dt>Your cushion</dt><dd>{budgetMoney(f.cushionCents / 100)}</dd></div>
        <div><dt>Planned monthly saving</dt><dd>{budgetMoney(a.contributionCents / 100)}</dd></div>
        {a.plannedPurchasesCents > 0 && <div><dt>One-time purchases · {f.windowDays} days</dt><dd>{budgetMoney(a.plannedPurchasesCents / 100)}</dd></div>}
        <div><dt>{shared ? 'Combined goal projection*' : 'Goal projection*'}</dt><dd>{budgetMoney(a.goalProjectedCents / 100)}</dd><small className="fine">Target {budgetMoney(a.goalTargetCents / 100)}{shared ? ' across separate deadlines' : ` by ${budgetDate(a.goalDate)}`}</small></div>
      </dl>
      {f.purchaseWeek && <p>Lowest checking in the purchase week ({budgetDate(f.purchaseWeek.startsOn)}–{budgetDate(f.purchaseWeek.endsOn)}): {budgetMoney(f.purchaseWeek.beforeLowCents / 100)} → {budgetMoney(f.purchaseWeek.afterLowCents / 100)}.</p>}
      <p className="fine">*Assumes the planned contributions are made. {!a.contributionFits && 'The calculator says those contributions do not keep your cushion intact. '}
        {a.checkedThrough && `Goal affordability checked through ${budgetDate(a.checkedThrough)}.`}</p>
    </div>}
    {compact && !a.contributionFits && <p className="fine">The calculator still finds a shortfall. Extra planned savings need another adjustment.</p>}
    {review.result ? <div className="review-reading">
      <span className="review-eyebrow">AI explanation · not a guarantee</span>
      <p>{review.result.summary}</p>
      <ul>{review.result.observations.map((o, i) => <li key={i}>{o.text}<small>{[...new Set(o.facts.map(sourceName))].join(' · ')}</small></li>)}</ul>
      {review.result.questions.length > 0 && <div><b>Worth checking</b><ul>{review.result.questions.map(q => <li key={q}>{q}</li>)}</ul></div>}
    </div> : <div className="review-reading" role="status"><b>AI explanation unavailable</b><p>{review.message}</p></div>}
    <details className="review-sources"><summary>What this answer used</summary>
      <p>The same RainCheck calculator as the forecast. Expected paychecks, spending and user-entered changes remain estimates.</p>
      {evidence.length ? evidence.map((e, i) => <div key={i}><b>{e.title}</b><p>{e.text}</p><small>Bank snapshot: {budgetDate(e.asOf)}</small></div>)
        : <p>No matching saved bank evidence was included. This answer uses only the calculator and your question.</p>}
      {retrieval?.status === 'outdated' && <p>The saved bank import is out of date, so it was excluded.</p>}
    </details>
    {review.id && <p className="fine"><a href={`/?review=${encodeURIComponent(review.id)}${review.accessToken ? `&reviewToken=${encodeURIComponent(review.accessToken)}` : ''}`} target="_blank" rel="noreferrer">Open saved review</a></p>}
  </article>;
}

/** Both entry points use this read-only conversation; applying stays outside it. */
export default function ReviewPanel({ baseVersion, plan, patch = {}, kind = 'plan', savedId, initialQuestion = '', preview = kind !== 'plan', focus, variant, protectedIds = {} }) {
  const savings = variant === 'savings';
  const [ready, setReady] = useState(null), [checkError, setCheckError] = useState(false);
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState(initialQuestion), [error, setError] = useState('');
  const [messages, setMessages] = useState([]), [saved, setSaved] = useState(null);
  const active = useRef(null), end = useRef(null);
  const check = () => {
    setCheckError(false); setReady(null);
    fetch('/api/review', { signal: AbortSignal.timeout(5000) }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setReady(d.available)).catch(() => { setReady(false); setCheckError(true); });
  };
  useEffect(() => { check(); return () => active.current?.abort(); }, []);
  useEffect(() => {
    if (!savedId) return;
    const controller = new AbortController();
    const token = new URLSearchParams(window.location.search).get('reviewToken');
    fetch(`/api/review?id=${encodeURIComponent(savedId)}${token ? `&token=${encodeURIComponent(token)}` : ''}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => setSaved(d.review))
      .catch(e => { if (e.name !== 'AbortError') setError('This saved review could not be opened.'); });
    return () => controller.abort();
  }, [savedId]);
  useEffect(() => { if (messages.length) end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages.length]);
  const send = async e => {
    e.preventDefault(); if (busy || !consent || !question.trim()) return;
    const asked = question.trim(); setBusy(true); setError('');
    const controller = new AbortController(); active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 115000);
    try {
      const r = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent, baseVersion, plan, patch, kind, question: asked,
          ...(focus === 'spending' ? { focus, protectedCategories: Object.keys(protectedIds).filter(id => protectedIds[id]) } : {}) }), signal: controller.signal });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'The review could not be started.');
      setMessages(m => [...m.slice(-4), { key: crypto.randomUUID(), question: asked, ...data }]);
      if (data.review.status === 'complete') setQuestion('');
    } catch (err) {
      if (active.current === controller) setError(err.name === 'AbortError' ? 'The review took too long. Your plan is unchanged; please try again.' : err.message);
    } finally { clearTimeout(timeout); if (active.current === controller) { setBusy(false); active.current = null; } }
  };
  const suggestions = savings ? ['Which flexible costs could I reduce?', 'What replacement costs should I consider?', 'How would this affect my savings goals?']
    : !preview ? ['Can my planned saving fit my budget?', 'What assumptions should I check?']
    : ['What changes in this preview?', 'Will this put my savings goal under pressure?'];
  return <section className="review-panel" aria-label="AI plan conversation">
    <ol className="review-layers" aria-label="How this works"><li>Calculate</li><li>Check evidence</li><li>Explain</li><li>You decide</li></ol>
    <p>{savings ? 'ZeroClaw reviews recorded category spending and calculated changes. Ask for practical options—not guaranteed savings.' : <>{!preview ? 'Ask about your current plan, in everyday language.' : 'Ask AI to explain this preview before you decide.'} The calculator handles the numbers; AI explains the trade-offs.</>}</p>
    {saved && <><p className="review-question"><b>Question in this saved review</b>{saved.facts.question || 'Explain this budget preview.'}</p>
      <ReviewAnswer review={saved} historical compact={savings} /><p><b>Ask about your current plan below.</b> New answers use your current decisions, not the saved preview above.</p></>}
    <div className="review-conversation" aria-label="Conversation">
      {messages.map(m => <div key={m.key}><p className="review-question"><b>You</b>{m.question}</p><ReviewAnswer review={m.review} retrieval={m.retrieval} impact={m.impact} compact={savings} /></div>)}
    </div>
    <div ref={end} />
    {ready === null ? <p role="status">Checking the review connection…</p> : !ready || !baseVersion ? <p className="alert">{checkError ? 'The review connection could not be checked.' : 'AI analysis is temporarily unavailable. Your calculator still works.'} <button className="link" onClick={check}>Try again</button></p> : <form className="review-compose" onSubmit={send}>
      <div className="review-suggestions">{suggestions.map(q => <button type="button" key={q} disabled={busy} onClick={() => setQuestion(q)}>{q}</button>)}</div>
      <label htmlFor="review-question">Your question</label>
      <textarea id="review-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={500} rows={3} required
        disabled={busy} placeholder="What should I watch out for in this plan?" />
      <label className="review-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />
        <span>Allow cloud review of this question and demo budget.</span></label>
      <details className="fine"><summary>What is shared?</summary><p>Your question, calculated before/after amounts, spending summaries and up to four supporting excerpts go through ZeroClaw to its cloud model. Reviews are saved on your server. No account credentials, private notes or full transaction history are sent. Don’t enter private information.</p></details>
      <button className="btn" disabled={!consent || !question.trim() || busy} type="submit">{busy ? 'Reviewing…' : 'Ask about this plan'}</button>
    </form>}
    {busy && <p role="status" className="review-progress">Recalculating your plan, finding matching evidence and asking AI. This may take about a minute. You don’t need to send it again.</p>}
    {error && <p role="alert" className="alert">{error}</p>}
  </section>;
}
