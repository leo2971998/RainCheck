/**
 * The weather, on the whole page.
 *
 * The hero has always reported the forecast in one corner. This lets the rest of the window
 * agree with it: when the projection falls below the cushion it rains, and when it is clear
 * there is warm light instead. Three sheets at different angles and speeds give the rain some
 * depth without a canvas or a single image request.
 *
 * It is decoration over a statement of fact, which puts two obligations on it. It reads the
 * same `sim.worst` the hero icon and every status pill read, so it can never contradict them —
 * there is no way to make it rain on a healthy forecast. And it must never cost legibility:
 * the layers are a few percent opaque, `pointer-events: none`, and sit below the drawers and
 * toasts, so nothing here is between the reader and a number.
 */
export function Ambient({ state }) {
  const raining = state === 'below' || state === 'over';
  const cls = [
    'ambient',
    raining ? 'raining' : '',
    state === 'over' ? 'storm' : '',
    state === 'ok' ? 'clear' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} aria-hidden="true">
      <div className="amb-glow" />
      <div className="amb-rain amb-r1" />
      <div className="amb-rain amb-r2" />
      <div className="amb-rain amb-r3" />
    </div>
  );
}
