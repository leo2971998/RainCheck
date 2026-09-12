<<<<<<< Updated upstream
export default function Alerts({ alerts, open }) {
  return (
    <div className="card">
      <div className="hd"><h2>Needs your attention</h2><span className="pill neutral">{alerts.length}</span></div>
      {alerts.length === 0 && <div className="fine">Nothing right now.</div>}
      {alerts.map((a, i) => <div className={'alert ' + a.tone} key={i}><b>{a.title}</b><p>{a.body}</p>{a.actions && <div className="row wrap" style={{ gap: 8 }}>{a.actions.map(ac => <button key={ac} className={'btn sm' + (ac === 'bill' ? '' : ' ghost')} onClick={() => open(ac)}>{ac === 'bill' ? 'See what changed' : 'Compare options'}</button>)}</div>}</div>)}
      <div className="fine">One event, one alert. Spending trends go in the weekly summary.</div>
=======
import { Icon } from './ui.jsx';

const ICON = { bad: 'warn', warn: 'up', good: 'check' };

export default function Alerts({ alerts, open }) {
  const needing = alerts.filter(a => a.tone !== 'good').length;
  return (
    <div className="card">
      <div className="hd">
        <h2>Needs your attention</h2>
        <span className={'pill ' + (needing ? 'warn' : 'good')}>{needing || 'Clear'}</span>
      </div>

      {alerts.length === 0 && <div className="fine">Nothing right now. Your bills are covered and your goal is on track.</div>}

      {alerts.map(a => (
        <div className={'alert ' + a.tone} key={a.id}>
          <b><Icon n={ICON[a.tone]} s={13} /> {a.title}</b>
          <p>{a.body}</p>
          {a.actions?.length > 0 && (
            <div className="row wrap" style={{ gap: 8 }}>
              {a.actions.map(action => (
                <button key={action.target} className={'btn sm' + (action.primary ? '' : ' ghost')} onClick={() => open(action.target)}>
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="fine">One event, one alert. A bill change and the cushion dip it causes arrive together, not twice. Spending trends go in the weekly summary.</div>
>>>>>>> Stashed changes
    </div>
  );
}
