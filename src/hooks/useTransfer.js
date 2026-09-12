import { useCallback, useState } from 'react';

/**
 * Requests a sandbox contribution, then reports only what the sandbox confirmed.
 * `pending` is true from the moment we ask until a status comes back, so the UI can say
 * "requested" rather than "done".
 */
export function useTransfer(source) {
  const [state, setState] = useState({ pending: false, status: null, error: null, result: null });

  const request = useCallback(async amount => {
    const operationId = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    setState({ pending: true, status: 'requested', error: null, result: null });
    try {
      const res = await fetch('/api/transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // Stable for this attempt, so a retry cannot become a second contribution.
        body: JSON.stringify({ amount, operationId }),
      });
      const body = await res.json().catch(() => ({}));
      // A half-completed pair is not a plain failure: money has already left checking.
      if (!res.ok) { setState({ pending: false, status: null, error: body.message || 'The transfer could not be confirmed.', result: body, halfCompleted: !!body.halfCompleted }); return; }
      setState({ pending: false, status: body.status, error: null, result: body });
    } catch (err) {
      setState({ pending: false, status: null, error: String(err.message || err), result: null, halfCompleted: false });
    }
  }, []);

  // Only offer it when we are actually talking to the sandbox. The saved snapshot is read-only.
  return { ...state, available: source === 'nessie', request };
}
