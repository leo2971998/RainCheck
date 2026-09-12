import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

/**
 * Light, dark, or whatever the machine prefers.
 *
 * The choice is stored, applied to the root element as `data-theme`, and — when left on
 * `auto` — follows the system setting live, so a laptop that switches to dark at sunset
 * carries the app with it.
 *
 * Dark is not only a palette here: the hero reads it as night, so the sky goes navy and the
 * sun becomes a moon. That is a deliberate coupling. What it must never do is change what the
 * weather *says*: the icon still comes from the forecast, so a dark theme reports a storm when
 * there is one and a clear night when there is not.
 */
const KEY = 'raincheck:theme';
const MODES = ['auto', 'light', 'dark'];

const systemDark = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

const stored = () => {
  try {
    const v = localStorage.getItem(KEY);
    return MODES.includes(v) ? v : 'auto';
  } catch { return 'auto'; }            // private mode, or storage blocked
};

export function useTheme() {
  const [mode, setMode] = useState(stored);
  const [sysDark, setSysDark] = useState(systemDark);

  // Only meaningful while the mode is `auto`, but the listener is cheap and keeping it
  // unconditional avoids a stale reading when the user switches back to auto.
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = e => setSysDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const dark = mode === 'dark' || (mode === 'auto' && sysDark);

  // Layout effect, so the attribute lands before the browser paints the new state.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';   // native form controls and scrollbars
  }, [dark]);

  const choose = useCallback(next => {
    setMode(next);
    try { localStorage.setItem(KEY, next); } catch { /* nothing to do about it */ }
  }, []);

  return { mode, dark, setMode: choose, MODES };
}
