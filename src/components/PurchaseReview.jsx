import { useEffect, useState } from 'react';

export default function PurchaseReview({ baseVersion, plan, patch, onStatus }) {
  const [attempt, setAttempt] = useState(0), [result, setResult] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    setResult(null); setError(''); onStatus('loading');
    const timer = setTimeout(() => controller.abort(), 115000);
    (async () => {
      try {
        // Let a discarded StrictMode mount clean up before starting a paid cloud request.
        await Promise.resolve();
        if (!mounted) return;
        const response = await fetch('/api/review', { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: true, baseVersion, plan,
            patch, kind: 'purchase', question: 'Can this purchase fit before its payment date while keeping the current goals? Explain the dated cash shortage and tested smaller-cost or later-date alternatives. A goal total assuming unaffordable contributions is not an achievable result. Future cuts cannot fix an earlier shortage.' }) });
        const data = await response.json();
        if (!response.ok || data.review?.status !== 'complete' || !data.review.result?.summary)
          throw new Error(response.status === 409 ? 'Your data changed. Reload purchases and check this preview again.' : 'AI could not finish. You can retry; the calculated purchase check below is still available.');
        if (mounted) { setResult(data.review.result); onStatus('ready'); }
      } catch (e) {
        if (mounted) { setError(e.name === 'AbortError' ? 'The review took too long. Try again.' : e.message); onStatus('error'); }
      } finally { clearTimeout(timer); }
    })();
    return () => { mounted = false; clearTimeout(timer); controller.abort(); };
  }, [baseVersion, plan, patch, attempt, onStatus]);
  return <section className="purchase-analysis-reading" aria-label="Purchase AI review" aria-live="polite">
    <h3>Plan review</h3>
    {result ? <p>{result.summary}</p> : error ? <><p role="alert">{error}</p>
      <button className="btn ghost sm" onClick={() => setAttempt(n => n + 1)}>Retry analysis</button></>
      : <p role="status">Analyzing this purchase against your budget and savings plan…</p>}
  </section>;
}
