import { useEffect, useRef, useState } from 'react';

const unavailable = 'We could not finish the analysis. Your budgets are unchanged. Please try again.';
const reload = 'Your data changed. Reload the page and try again.';
const missing = 'Reload your spending data before optimizing budgets.';
const connectionErrors = {
  403: 'AI analysis is not available on this version yet. Your budgets are unchanged.',
  429: 'Several analyses were requested recently. Please wait a minute and try again. Your budgets are unchanged.',
  503: 'Analysis is temporarily unavailable. Please try again shortly. Your budgets are unchanged.',
};
export async function requestOptimization({ baseVersion, plan, protectedIds = {} }, { signal, fetcher = fetch } = {}) {
  if (!baseVersion) throw new Error(missing);
  const response = await fetcher('/api/review', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: true, baseVersion, plan, patch: {}, kind: 'plan', focus: 'spending', optimize: true,
      protectedCategories: Object.keys(protectedIds).filter(id => protectedIds[id]), question: 'Optimize my monthly spending budgets and explain the proposed limits.' }) });
  if (!response.ok) throw new Error(response.status === 409 ? reload : connectionErrors[response.status] || unavailable);
  const data = await response.json();
  if (data.review?.status !== 'complete' || !data.review.result?.summary || !data.optimization?.draft?.targets) throw new Error(unavailable);
  return data;
}

/** A click starts one request. Closing, navigating, or changing the source invalidates it. */
export default function useBudgetOptimization(input) {
  const key = JSON.stringify(input);
  const [state, setState] = useState({ status: 'idle' });
  const active = useRef(null), source = useRef(key);
  source.current = key;
  const cancel = () => { const request = active.current; active.current = null; request?.controller.abort(); };
  useEffect(() => () => cancel(), [key]);
  const start = async () => {
    if (active.current?.key === key) return;
    cancel();
    const controller = new AbortController(); active.current = { controller, key };
    setState({ status: 'loading', key });
    const timeout = setTimeout(() => controller.abort(), 115000);
    try {
      const data = await requestOptimization(input, { signal: controller.signal });
      if (active.current?.controller === controller && source.current === key) setState({ status: 'ready', key, data });
    } catch (e) {
      if (active.current?.controller === controller && source.current === key) setState({ status: 'error', key,
        error: e.name === 'AbortError' ? 'The analysis took too long. Your budgets are unchanged. Please try again.' : [reload, missing, ...Object.values(connectionErrors)].includes(e.message) ? e.message : unavailable });
    } finally { clearTimeout(timeout); if (active.current?.controller === controller) active.current = null; }
  };
  return { state: state.key && state.key !== key ? { status: 'stale' } : state, start, cancel };
}
