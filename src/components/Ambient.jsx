import './ambient.css';

// Shared forecast state drives both the quiet page background and the clearer hero rain.
export function Ambient({ state, contained = false }) {
  const raining = state === 'below' || state === 'over';
  const cls = [
    'ambient',
    contained ? 'contained' : '',
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
