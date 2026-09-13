import { useEffect, useState } from 'react';

export default function PurchaseReview({ baseVersion, plan, patch, onStatus, onResult, onRefresh }) {
  const [attempt, setAttempt] = useState(0), [result, setResult] = useState(null), [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const requestKey = JSON.stringify({ baseVersion, plan, patch });
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    setResult(null); setError(''); setStale(false); onResult?.(null); onStatus('loading');
    const timer = setTimeout(() => controller.abort(), 115000);
    (async () => {
      try {
        // Let a discarded StrictMode mount clean up before starting a paid cloud request.
        await Promise.resolve();
        if (!mounted) return;
        const response = await fetch('/api/review', { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: true, baseVersion, plan,
            patch, kind: 'purchase', question: 'Recommend a practical purchase plan from the tested alternatives. If the requested date fails, explain how a later date preserves the purchase amount and goal contributions, or how a smaller cost helps. Use observations to explain what to do and why, not just repeat the shortfall. Do not invent category cuts, income or feasible dates. A hypothetical goal total is not achieved savings. Later savings cannot cover an earlier payment.' }) });
        const data = await response.json();
        if (mounted && response.status === 409) setStale(true);
        if (!response.ok || data.review?.status !== 'complete' || !data.review.result?.summary || (onResult && !data.impact?.funding))
          throw new Error(response.status === 409 ? 'Your data changed. Reload purchases and check this preview again.' : 'AI could not finish your purchase plan. Your saved purchases are unchanged. Please retry.');
        if (mounted) { setResult({ key: requestKey, value: data.review.result }); onResult?.({ key: requestKey, data }); onStatus('ready'); }
      } catch (e) {
        if (mounted) { setError(e.name === 'AbortError' ? 'The review took too long. Try again.' : e.message); onStatus('error'); }
      } finally { clearTimeout(timer); }
    })();
    return () => { mounted = false; clearTimeout(timer); controller.abort(); };
  }, [baseVersion, plan, patch, attempt, onStatus, onResult]);
  const ready = result?.key === requestKey ? result.value : null;
  if (!ready) return error ? <div className="optimization-wait" role="alert"><h3>Analysis could not finish</h3><p>{error}</p>
    <button className="btn" onClick={stale && onRefresh ? onRefresh : () => setAttempt(n => n + 1)}>{stale && onRefresh ? 'Reload purchases' : 'Retry analysis'}</button></div>
    : <div className="optimization-wait" role="status" aria-live="polite"><span className="optimization-spinner" aria-hidden="true" />
      <h3>Analyzing your purchase</h3><p>Reviewing spending, upcoming bills and savings goals. Checking ways to make this purchase work.</p>
      <p className="fine">This can take about a minute. Nothing is saved while we review.</p></div>;
  return <section className="purchase-analysis-reading" aria-label="Purchase AI review" aria-live="polite">
    <h3>Your purchase plan</h3><p>{ready.summary}</p>
    {!!ready.observations?.length && <details><summary>Why this plan</summary><ul className="purchase-review-reasons">{ready.observations.map((o, i) => <li key={i}>{o.text}</li>)}</ul></details>}
  </section>;
}
