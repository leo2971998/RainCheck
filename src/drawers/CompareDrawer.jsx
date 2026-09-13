import { Icon, Toggle, money, prettyIso } from '../components/ui.jsx';
import { simulate, hypothetical } from '../engine/forecast.js';
import Drawer from '../components/Drawer.jsx';
import { MiniForecast } from '../components/charts.jsx';

/**
 * Every option is measured the same three ways, so the comparison is genuinely like for like.
 * Putting a $180 dining allowance beside a $300 savings contribution under a "before and after"
 * heading compares different things without saying anything untrue — which is worse than useless.
 */
const ROWS = [
  { key: 'contribution', label: 'Monthly contribution', fmt: o => money(o.contribution) },
  { key: 'low', label: 'Lowest projected balance', fmt: o => money(o.low), sub: o => prettyIso(o.lowDate) },
  { key: 'meetsCushion', label: 'Keeps your checking target', fmt: (o, h) => o.meetsCushion ? 'Yes' : 'No', tone: o => o.meetsCushion ? 'good' : 'bad' },
  { key: 'goalProjected', label: 'Goal reaches', fmt: o => money(o.goalProjected),
    sub: o => `${o.shared ? 'Across separate goal deadlines' : `by ${o.goalDate ? prettyIso(o.goalDate) : '—'}`} · ${o.onTarget ? 'on target' : `${money(o.goalGap)} short`}` },
];

export default function CompareDrawer({ h, sc, cap, options, current, preview, previewSim, previewGoal, setPreviewId, protectedIds, setProtectedIds, onApply, onClose }) {
  const currentSim = simulate(h, sc);
  const live = options.filter(o => !o.disabled);
  const chosen = preview && live.find(o => o.id === preview.id);

  return (
    <Drawer label="Compare options" onClose={onClose}>
      <div className="row between">
        <h2>Compare options</h2>
        <button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon n="x" s={16} /></button>
      </div>

      <p style={{ margin: 0, color: 'var(--ink-2)' }}>
        Your current plan reaches {money(current.goalProjected)}{current.onTarget ? '' : `, ${money(current.goalGap)} short of ${money(h.goal.target)}`}
        {current.meetsCushion ? '' : `, and dips to ${money(current.low)} on ${prettyIso(current.lowDate)}`}.
        Selecting an option previews it on your forecast.
      </p>

      {!current.meetsCushion && !live.some(o => !o.conditional && o.outcome.meetsCushion) && <div className="alert">
        <b>None of these changes fully protects your {money(h.cushion)} target.</b>
        <p>Check your expected income and costs, or review planned purchases. An improvement is not the same as resolving the warning.</p>
      </div>}

      <div>
        <h3 style={{ marginBottom: 8 }}>Protect</h3>
        <div className="row wrap" style={{ gap: 12 }}>
          {h.allowances.map(a => (
            <Toggle key={a.id} on={!!protectedIds[a.id]} onChange={v => setProtectedIds(p => ({ ...p, [a.id]: v }))}>{a.label}</Toggle>
          ))}
        </div>
        <div className="fine" style={{ marginTop: 6 }}>A protected allowance is never offered as something to cut.</div>
      </div>

      <div className="fine only-narrow" style={{ marginBottom: -6 }}>
        {preview ? `Comparing your plan with: ${preview.title}` : 'Choose an option below to compare it with your plan.'}
      </div>

      <div className="scroll-x">
        <table className="compare">
          <thead>
            <tr>
              <th>Outcome</th>
              <th className="r">Now</th>
              {live.map(o => (
                <th key={o.id} className={'r' + (preview && preview.id !== o.id ? ' extra-col' : '')} style={{ minWidth: 110 }}>
                  <button className={'chip' + (preview?.id === o.id ? ' on' : '')} onClick={() => setPreviewId(preview?.id === o.id ? null : o.id)}
                    aria-pressed={preview?.id === o.id} style={{ whiteSpace: 'normal', textAlign: 'left' }}>
                    {shortTitle(o)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(row => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="r">{row.fmt(current, h)}{row.sub && <div className="fine">{row.sub(current)}</div>}</td>
                {live.map(o => {
                  const hideOnNarrow = preview && preview.id !== o.id;
                  const better = row.key === 'meetsCushion' && o.outcome.meetsCushion && !current.meetsCushion;
                  return (
                    <td key={o.id} className={'r' + (hideOnNarrow ? ' extra-col' : '')} style={{ background: preview?.id === o.id ? 'var(--accent-bg)' : undefined }}>
                      {row.tone
                        ? <span className={'pill ' + row.tone(o.outcome)}>{row.fmt(o.outcome, h)}</span>
                        : <b>{row.fmt(o.outcome, h)}</b>}
                      {row.sub && <div className="fine">{row.sub(o.outcome)}</div>}
                      {better && <div className="fine" style={{ color: 'var(--good)' }}>fixes the dip</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fine">
        The goal row is a projection: {live[0]?.outcome.assumption}
      </div>

      <div className="card" style={{ padding: 12, gap: 8 }}>
        <div className="row between">
          <h3>{preview ? `Previewing: ${preview.title}` : 'Your forecast now'}</h3>
          {preview && <button className="link" style={{ fontSize: 13 }} onClick={() => setPreviewId(null)}>Clear</button>}
        </div>
        <MiniForecast h={h} sim={currentSim} preview={previewSim} />
        <div className="fine">
          {preview
            ? `Dashed: this option. Solid: your plan today. Lowest ${money(previewSim.low.balance)} against ${money(currentSim.low.balance)}.`
            : 'Select an option to draw it here.'}
        </div>
      </div>

      {live.map(o => (
        <div key={o.id} className={'option' + (preview?.id === o.id ? ' on' : '')}>
          <div className="row between">
            <h3>{o.title}</h3>
            {o.conditional && <span className="pill neutral">Conditional</span>}
          </div>
          <p>{o.detail}</p>
          <p className="fine">{o.outcome.meetsCushion
            ? `Keeps at least ${money(h.cushion)} in checking in this forecast${o.conditional ? ', if confirmed' : ''}.`
            : `Still below your ${money(h.cushion)} checking target. This option does not fully resolve the warning.`}</p>
          {o.conditional && <p className="fine">This preview also assumes {money(o.outcome.contribution)}/month in savings. Confirming the cancellation alone does not change your planned savings amount.</p>}
          {o.note && <div className="fine">{o.note}</div>}
          <div className="row between">
            <button className={'btn sm' + (preview?.id === o.id ? '' : ' ghost')} onClick={() => setPreviewId(preview?.id === o.id ? null : o.id)}>
              {preview?.id === o.id ? 'Previewing' : 'Preview on my forecast'}
            </button>
            <button className="btn sm" onClick={() => onApply(o)}>Apply this plan <Icon n="arrow" s={14} /></button>
          </div>
        </div>
      ))}

      {options.filter(o => o.disabled).map(o => (
        <div className="option" style={{ opacity: 0.6 }} key={o.id}><h3>{o.title}</h3><p>{o.detail}</p></div>
      ))}

      <div className="alert good">
        <b>No option hides a cost.</b>
        <p>Moving money out of savings would fix checking while shrinking the goal, so it is not offered. A cancellation you have not confirmed does not improve your forecast either.</p>
      </div>

      {chosen && <button className="btn" onClick={() => onApply(chosen)}>Apply {shortTitle(chosen).toLowerCase()} <Icon n="arrow" s={15} /></button>}
    </Drawer>
  );
}

function shortTitle(o) {
  return { keep: 'Contribute less', reduce: 'Trim spending', renewal: 'Cancel renewal', date: 'More time' }[o.id] || o.title;
}
