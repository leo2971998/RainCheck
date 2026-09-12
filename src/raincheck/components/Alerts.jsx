export default function Alerts({ alerts, open }) {
  return (
    <div className="card">
      <div className="hd"><h2>Needs your attention</h2><span className="pill neutral">{alerts.length}</span></div>
      {alerts.length === 0 && <div className="fine">Nothing right now.</div>}
      {alerts.map((a, i) => <div className={'alert ' + a.tone} key={i}><b>{a.title}</b><p>{a.body}</p>{a.actions && <div className="row wrap" style={{ gap: 8 }}>{a.actions.map(ac => <button key={ac} className={'btn sm' + (ac === 'bill' ? '' : ' ghost')} onClick={() => open(ac)}>{ac === 'bill' ? 'See what changed' : 'Compare options'}</button>)}</div>}</div>)}
      <div className="fine">One event, one alert. Spending trends go in the weekly summary.</div>
    </div>
  );
}
