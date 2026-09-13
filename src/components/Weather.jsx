import { useId } from 'react';
import { budgetMoney as money } from './BudgetImpact.jsx';

/**
 * Weather, drawn rather than typed.
 *
 * The emoji glyphs the hero used to carry rendered differently on every platform and could not
 * be animated as parts — a sun whose rays turn, a cloud that drifts, rain that falls. These are
 * SVG groups, so each part moves on its own, and the icon can cross-fade to a different state.
 *
 * Two separate things decide what is shown, on purpose:
 *   the supplied severity state picks the forecast (sun / partly / rain / storm)
 *   the selected appearance picks the scene       (day / night)
 * so dark mode keeps its moonlit identity even when rain arrives. Appearance never changes the
 * budget result; only the calculated severity can add rain or a storm.
 */

const RANK = { ok: 0, tight: 1, below: 2, over: 3 };

// Balance risk takes priority. A review reminder can add clouds, never invent a storm.
export function forecastWeather(state, alerts = []) {
  if (state === 'over' || state === 'below' || state === 'tight') return state;
  return alerts.some(a => a.tone !== 'good') ? 'tight' : 'ok';
}

/** The icon a forecast state earns, and its night-time counterpart. */
export function kindFor(state, night = false) {
  const day = { ok: 'sun', tight: 'partly', below: 'rain', over: 'storm' }[state] ?? 'sun';
  if (!night) return day;
  return {
    sun: 'moon',
    partly: 'partly-night',
    rain: 'rain-night',
    storm: 'storm-night',
  }[day] ?? day;
}

/** Clock-based scenes remain available to forecast surfaces that are not tied to the UI theme. */
export function timeOfDay(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'night' : h < 8 ? 'dawn' : h < 17 ? 'day' : h < 20 ? 'dusk' : 'night';
}

// Cloud as a union of discs over a base, so one fill and no stroke reads as a soft shape.
function Cloud({ dark = false, y = 0 }) {
  const fill = dark ? 'url(#wx-cloud-dark)' : 'url(#wx-cloud)';
  return (
    <g className="wx-cloud" transform={`translate(0 ${y})`}>
      <circle cx="24" cy="40" r="9" fill={fill} />
      <circle cx="35" cy="34" r="12.5" fill={fill} />
      <circle cx="46" cy="40" r="9" fill={fill} />
      <rect x="24" y="40" width="22" height="9" fill={fill} />
    </g>
  );
}

function Sun({ cx = 32, cy = 32, r = 11, rays = 6 }) {
  return (
    <g className="wx-sun">
      <g className="wx-rays" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {Array.from({ length: 8 }, (_, i) => (
          <line key={i} x1={cx} y1={cy - r - 3} x2={cx} y2={cy - r - 3 - rays}
            transform={`rotate(${i * 45} ${cx} ${cy})`} />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={r} className="wx-disc" />
    </g>
  );
}

function Moon() {
  return (
    <g className="wx-moon">
      <circle cx="34" cy="30" r="15" fill="url(#wx-moon)" mask="url(#wx-crescent)" />
      <circle cx="16" cy="16" r="1.4" className="wx-star" />
      <circle cx="52" cy="12" r="1.1" className="wx-star" style={{ animationDelay: '.9s' }} />
      <circle cx="54" cy="30" r="1.3" className="wx-star" style={{ animationDelay: '1.6s' }} />
    </g>
  );
}

function Drops({ n = 3, heavy = false }) {
  const xs = n === 3 ? [26, 35, 44] : [24, 31, 38, 45];
  return (
    <g className="wx-drops">
      {xs.map((x, i) => (
        <line key={x} x1={x} y1="51" x2={x - 1.5} y2={heavy ? 58 : 56} className="wx-drop"
          style={{ animationDelay: `${i * 0.28}s` }} />
      ))}
    </g>
  );
}

function Bolt() {
  return <polygon className="wx-bolt" points="35,42 29,52 34,52 31,61 40,49 35,49 38,42" />;
}

const KINDS = ['sun', 'partly', 'rain', 'storm', 'moon', 'partly-night', 'rain-night', 'storm-night'];

/** One weather icon. `kind` is one of KINDS. */
export function WeatherIcon({ kind = 'sun', size = 48, title }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`wx wx-${kind}`}
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id="wx-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dbe7f3" />
        </linearGradient>
        <linearGradient id="wx-cloud-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fa3bd" /><stop offset="1" stopColor="#5b6f8c" />
        </linearGradient>
        <radialGradient id="wx-sun" cx=".4" cy=".35" r=".75">
          <stop offset="0" stopColor="#fff3b0" /><stop offset="1" stopColor="#f5b400" />
        </radialGradient>
        <radialGradient id="wx-moon" cx=".4" cy=".35" r=".8">
          <stop offset="0" stopColor="#fbf6e4" /><stop offset="1" stopColor="#d8d2b8" />
        </radialGradient>
        <mask id="wx-crescent">
          <rect width="64" height="64" fill="#fff" /><circle cx="42" cy="24" r="13" fill="#000" />
        </mask>
      </defs>
      {kind === 'sun' && <Sun />}
      {kind === 'partly' && <><Sun cx={25} cy={24} r={9} rays={5} /><Cloud y={4} /></>}
      {kind === 'rain' && <><Cloud /><Drops /></>}
      {kind === 'storm' && <><Cloud dark /><Bolt /><Drops n={4} heavy /></>}
      {kind === 'moon' && <Moon />}
      {kind === 'partly-night' && <><Moon /><Cloud y={6} /></>}
      {kind === 'rain-night' && <><Moon /><Cloud dark y={6} /><Drops /></>}
      {kind === 'storm-night' && <><Moon /><Cloud dark y={6} /><Bolt /><Drops n={4} heavy /></>}
    </svg>
  );
}

/**
 * The hero's weather. Every kind is mounted and stacked; only the current one is opaque, so a
 * change of state cross-fades one icon into the next instead of swapping glyphs.
 */
export function Sky({ state, night = false, size = 150 }) {
  const kind = kindFor(state, night);
  return (
    <div className="sky-stack" aria-hidden="true">
      {KINDS.map(k => (
        <div key={k} className={'sky-icon' + (k === kind ? ' on' : '')}>
          <WeatherIcon kind={k} size={size} />
        </div>
      ))}
    </div>
  );
}

const short = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const WORDS = { ok: 'Room to spare', tight: 'Little room left', below: 'Getting tight', over: 'Short of money' };

/**
 * The outlook: one icon per week across the forecast, the way a weather app shows the days ahead.
 * The worst day in the week decides the icon, because a week with one overdrawn day is a week
 * to worry about — an average would hide exactly the day that matters.
 */
export function Outlook({ sim, h, days = 7 }) {
  const helpId = useId();
  const weeks = [];
  for (let i = 0; i < sim.days.length; i += days) weeks.push(sim.days.slice(i, i + days));
  return (
    <section className="weekly-checking" aria-label="Weekly checking forecast">
    <p className="outlook-help" id={helpId}>
      <span>Each card shows the least money expected in checking during those dates.</span>
      <span>Checking buffer: <b>{money(h.cushion)}</b> for unexpected costs. This is separate from your savings goals.</span>
    </p>
    <div className="outlook" role="list" aria-label="Weekly outlook" aria-describedby={helpId}>
      {weeks.map((w, i) => {
        const worst = w.reduce((a, d) => (RANK[d.state] > RANK[a.state] ? d : a), w[0]);
        const low = w.reduce((a, d) => (d.balance < a.balance ? d : a), w[0]);
        const label = `${short(w[0].date)} – ${short(w[w.length - 1].date)}`;
        const threshold = {
          ok: `Over ${money(h.cushion)}`,
          tight: `${low.balance === h.cushion ? 'At' : 'Just over'} ${money(h.cushion)}`,
          below: `Under ${money(h.cushion)}`,
          over: 'Under $0',
        }[worst.state];
        return (
          <div key={i} role="listitem" className={`ol-week st-${worst.state}`} style={{ '--i': i }}>
            <WeatherIcon kind={kindFor(worst.state)} size={36} />
            <span className="ol-range">{label}</span>
            <span className="ol-balance num">{money(low.balance)} left</span>
            <span className="ol-date">on {short(low.date)}</span>
            <span className="ol-word">{WORDS[worst.state]}</span>
            <span className="ol-threshold">{threshold}</span>
            <details className="ol-details">
              <summary aria-label={`View estimate for ${label}`}>What’s included?</summary>
              <p className="ol-low">Checking could drop to <strong className="num">{money(low.balance)}</strong><span>on {short(low.date)}</span></p>
              <p className="ol-assumptions">End-of-day estimate, not today's balance. Includes expected income, bills, spending and planned savings.</p>
              <p className="ol-assumptions">{w.flatMap(d => (d.events || []).filter(e => e.bill || e.transfer).map(e => `${e.label} ${money(-e.amt)} (${short(d.date)})`)).join(' · ') || 'No bills or savings scheduled in this period.'}</p>
            </details>
          </div>
        );
      })}
    </div>
    </section>
  );
}
