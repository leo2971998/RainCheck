import { useCallback, useState } from 'react';

/**
 * Requests a sandbox contribution, then reports only what the sandbox confirmed.
 * `pending` is true from the moment we ask until a status comes back, so the UI can say
 * "requested" rather than "done".
 */
export function useTransfer(source) {
  const [state, setState] = useState({ pending: false, status: null, error: null, result: null });

  const request = useCallback(async amount => {
    setState({ pending: true, status: 'requested', error: null, result: null });
    try {
      const res = await fetch('/api/transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'The transfer could not be confirmed.');
      setState({ pending: false, status: body.status, error: null, result: body });
    } catch (err) {
      setState({ pending: false, status: null, error: String(err.message || err), result: null });
    }
  }, []);

  // Only offer it when we are actually talking to the sandbox. The saved snapshot is read-only.
  return { ...state, available: source === 'nessie', request };
}
