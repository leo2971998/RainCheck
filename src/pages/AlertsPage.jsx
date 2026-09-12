import { Icon } from '../components/ui.jsx';
import Alerts from '../components/Alerts.jsx';
import Reminders from '../components/Reminders.jsx';

/** Describes the gap between the first two expected paychecks in words, rather than assuming it. */
function cadenceWords(income) {
  if (income.length < 2) return 'month';
  const days = Math.round((new Date(income[1].date) - new Date(income[0].date)) / 864e5);
  return days <= 8 ? 'week' : days <= 16 ? 'two weeks' : days <= 24 ? 'three weeks' : 'month';
}

/**
 * Everything RainCheck wants to tell you, in one place.
 *
 * These used to sit in a column on Today beside the forecast, which made the front page a list
 * of everything at once. Today now shows the forecast and what changed it; this page holds the
 * alerts, the bills due soon, notices waiting to be read, and the one-time summary of what was
 * found in the records. The bell on Today counts what is here.
 */
export default function AlertsPage({ h, alerts, reminders, leadDays, setLeadDays, onPaid, waiting = [], onReviewNotice, open, found, setFound }) {
  const attention = alerts.filter(a => a.tone !== 'good').length + reminders.length + waiting.length;
  const reviewCount = h.recurring.filter(r => r.unexplained).length;
  return (
    <>
      <div className="topbar">
        <div><h1>Alerts</h1>
          <div className="sub">{attention
            ? `${attention} thing${attention === 1 ? '' : 's'} need${attention === 1 ? 's' : ''} your attention`
            : 'Nothing needs your attention right now'} · one event, one alert</div></div>
      </div>

      <div className="grid g32">
        <div className="grid" style={{ gap: 18 }}>
          {waiting.length > 0 && (
            <div className="card">
              <div className="hd"><h2>Waiting to be reviewed</h2><span className="pill accent">{waiting.length}</span></div>
              {waiting.map(n => (
                <div className="row" style={{ alignItems: 'flex-start' }} key={n.id}>
                  <div className="cat"><i className="rev"><Icon n="mail" s={14} /></i></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>A notice is waiting to be reviewed</div>
                    <div className="fine">{n.originLabel}</div>
                    <div className="fine">Not counted in your forecast until you accept it.</div>
                  </div>
                  <button className="btn sm" onClick={() => onReviewNotice(n)}>Review it</button>
                </div>
              ))}
            </div>
          )}
          <Alerts alerts={alerts} open={open} />
        </div>

        <div className="grid" style={{ gap: 18 }}>
          <Reminders reminders={reminders} leadDays={leadDays} setLeadDays={setLeadDays} onPaid={onPaid} />
          {found && (
            <div className="card" style={{ background: 'var(--insight-bg)' }}>
              <div className="hd"><h2>Here is what we found</h2><button className="link" onClick={() => setFound(false)}>Dismiss</button></div>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="pill good"><Icon n="check" s={11} />Paycheck about every {cadenceWords(h.income)}</span>
                <span className="pill good"><Icon n="check" s={11} />{h.recurring.length} recurring commitments</span>
                {reviewCount > 0 && <span className="pill warn">{reviewCount} charge{reviewCount === 1 ? ' needs' : 's need'} review</span>}
              </div>
              <div><button className="btn ghost sm" onClick={() => open('page:transactions')}>Review my plan</button></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
