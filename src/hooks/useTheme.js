import { useCallback, useLayoutEffect, useState } from 'react';

/**
 * Explicit Light/Dark preference. Retired Auto preferences default to Light.
 * Appearance never changes the financial forecast or follows system-theme changes.
 */
const KEY = 'raincheck:theme';
const MODES = ['light', 'dark'];

const stored = () => {
  try {
    const v = localStorage.getItem(KEY);
    return MODES.includes(v) ? v : 'light';
  } catch { return 'light'; }            // private mode, or storage blocked
};

export function useTheme() {
  const [mode, setMode] = useState(stored);
  const dark = mode === 'dark';

  // Layout effect, so the attribute lands before the browser paints the new state.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';   // native form controls and scrollbars
  }, [dark]);

  const choose = useCallback(next => {
    if (!MODES.includes(next)) return;
    setMode(next);
    try { localStorage.setItem(KEY, next); } catch { /* nothing to do about it */ }
  }, []);

  return { mode, dark, setMode: choose, MODES };
}
