import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Motion primitives for RainCheck.
 *
 * The point of movement here is not decoration: it is to make a change legible. When a bill
 * increase is accepted, four numbers and two lines move at once, and a viewer who blinks sees a
 * different screen with no idea what caused it. Tweening those changes shows the cause.
 *
 * Every hook below degrades to an instant, correct result — when the reader asks for reduced
 * motion, when the browser lacks the API, or when two shapes cannot be interpolated.
 */

/** Honours the reader's system setting, and keeps honouring it if they change it mid-session. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = e => setReduced(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

const easeOut = t => 1 - Math.pow(1 - t, 3);

/**
 * Counts from the previous value to the new one.
 *
 * The first value is never animated — a dashboard should not count up from zero on arrival, which
 * reads as a loading state and delays the number the reader came for.
 */
export function useCountUp(value, ms = 550) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) { started.current = true; from.current = value; setShown(value); return; }
    if (reduced || !Number.isFinite(value) || !Number.isFinite(from.current)) {
      from.current = value; setShown(value); return;
    }
    const a = from.current, b = value;
    if (a === b) return;

    let raf, timer, t0, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf); clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      from.current = b; setShown(b);
    };
    const onVisibility = () => { if (document.hidden) finish(); };
    const tick = now => {
      t0 ??= now;
      const t = Math.min(1, (now - t0) / ms);
      if (t >= 1) return finish();
      setShown(a + (b - a) * easeOut(t));
      raf = requestAnimationFrame(tick);
    };

    // requestAnimationFrame does not run while the document is hidden, so a tween begun in a
    // background tab would freeze partway and never arrive — leaving a stale number beside fresh
    // ones. Timers still fire, so the destination is guaranteed whether or not a frame is painted.
    if (document.hidden) { finish(); return; }
    document.addEventListener('visibilitychange', onVisibility);
    timer = setTimeout(finish, ms + 150);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      from.current = b;
    };
  }, [value, ms, reduced]);

  return shown;
}

// An SVG path splits into a template plus its numbers, so two paths with the same command
// structure can be interpolated point by point. The marker has to be something path data can
// never contain — a space would match the separators already in the string.
const NUM = /-?\d*\.?\d+/g;
const parsePath = d => {
  const nums = [];
  const tpl = String(d).replace(NUM, m => { nums.push(parseFloat(m)); return '~'; });
  return { tpl, nums };
};
const buildPath = (tpl, nums) => { let i = 0; return tpl.replace(/~/g, () => nums[i++].toFixed(1)); };

/**
 * Morphs one path into another, writing straight to the DOM node.
 *
 * It deliberately does not go through React state: a forecast chart re-renders thirty-odd days of
 * markers, and doing that sixty times a second to move one line is how a smooth idea becomes a
 * stuttering one. Paths whose command structure differs — a goal that gained a contribution, say —
 * are set outright rather than interpolated into nonsense.
 */
export function useMorphPath(d, ms = 560) {
  const ref = useRef(null);
  const prev = useRef(d);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced || prev.current === d) { prev.current = d; return; }
    const a = parsePath(prev.current), b = parsePath(d);
    if (a.tpl !== b.tpl || a.nums.length !== b.nums.length) { prev.current = d; return; }

    let raf, timer, t0, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf); clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      prev.current = d; el.setAttribute('d', d);
    };
    const onVisibility = () => { if (document.hidden) finish(); };
    const tick = now => {
      t0 ??= now;
      const t = Math.min(1, (now - t0) / ms);
      if (t >= 1) return finish();
      const e = easeOut(t);
      el.setAttribute('d', buildPath(b.tpl, a.nums.map((v, i) => v + (b.nums[i] - v) * e)));
      raf = requestAnimationFrame(tick);
    };

    // Same guarantee as the counter: a hidden document paints no frames, and a line stuck at the
    // shape it had before the change would contradict every number around it.
    if (document.hidden) { finish(); return; }
    el.setAttribute('d', buildPath(a.tpl, a.nums));      // start from where the eye last saw it
    document.addEventListener('visibilitychange', onVisibility);
    timer = setTimeout(finish, ms + 150);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      prev.current = d; el.setAttribute('d', d);
    };
  }, [d, ms, reduced]);

  return ref;
}
