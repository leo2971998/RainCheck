import { useEffect, useRef, useState } from 'react';

const KEY = 'raincheck.v1';

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

/**
 * State that survives navigation and reload.
 *
 * Without this, "Apply", "Save" and "Corrected" do not mean what people reasonably expect: a
 * category correction lived inside the Transactions page and vanished the moment you navigated
 * away. A decision the user made should still be there when they come back.
 *
 * Stored per browser, never sent anywhere. `reset()` clears everything the user has decided.
 */
export function usePersistentState(name, initial) {
  const [value, setValue] = useState(() => {
    const saved = readAll()[name];
    return saved === undefined ? initial : saved;
  });

  // Skip the first write so opening the app never rewrites what is already stored.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    try {
      const all = readAll();
      if (value === undefined || value === null) delete all[name]; else all[name] = value;
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* private browsing, or storage full: the app still works, it just forgets */ }
  }, [name, value]);

  return [value, setValue];
}

/** Forget every decision the user has made, then reload into a clean state. */
export function clearPersisted() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

export function hasPersisted() {
  return Object.keys(readAll()).length > 0;
}
