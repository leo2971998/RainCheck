import { Icon, money, prettyIso } from './ui.jsx';
import { LEAD_TIMES } from '../engine/reminders.js';

/**
 * Due-date reminders, which are a different thing from the alert list: an alert is about a change,
 * a reminder is about a date. It stops the moment the user confirms the payment.
 *
 * These are in-app only, and the card says so. A reminder the user never sees because the app is
 * closed is not a reminder, and pretending otherwise would be the easiest lie in the product.
 */
export default function Reminders({ reminders, leadDays, setLeadDays, onPaid }) {
  return (
    <div className="card">
      <div className="hd">
        <h2>Coming up</h2>
        <span className={'pill ' + (reminders.length ? 'warn' : 'good')}>{reminders.length || 'Clear'}</span>
      </div>

      <div className="row wrap" style={{ gap: 6 }}>
        <span className="fine">Remind me</span>
        {LEAD_TIMES.map(t => (
          <button key={t.days} className={'chip' + (leadDays === t.days ? ' on' : '')}
            aria-pressed={leadDays === t.days} onClick={() => setLeadDays(t.days)}>{t.label}</button>
        ))}
      </div>

      {reminders.length === 0 && <div className="fine">Nothing charges in the next {leadDays} days.</div>}

      <div className="list">
        {reminders.map(r => (
          <div className="item" key={r.id}>
            <span className="when">{prettyIso(r.due)}</span>
            <div className="what">
              <strong>{r.label}</strong>
              <small>Charges {r.when}</small>
            </div>
            <span className="amt">{money(r.amount)}</span>
            <button className="btn ghost sm" onClick={() => onPaid(r)}>
              <Icon n="check" s={13} />Paid
            </button>
          </div>
        ))}
      </div>

      <div className="fine">
        Shown while RainCheck is open. It does not send notifications to your phone.
        Marking one paid stops it until the next charge.
      </div>
    </div>
  );
}
