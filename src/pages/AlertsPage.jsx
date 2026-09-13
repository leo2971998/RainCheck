import { Icon, money, moneyPrecise, prettyIso } from '../components/ui.jsx';
import { BillReviewHistory } from '../components/BillReviews.jsx';
import Reminders from '../components/Reminders.jsx';

const rank = { bad: 0, warn: 1 };
const formatAmount = amount => Number.isInteger(amount) ? money(amount) : moneyPrecise(amount);
const planDate = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
});

function AlertActions({ item, open }) {
  if (!item.actions?.length) return null;
  return <div className="alert-actions">{item.actions.map((action, index) => (
    <button key={`${action.target || 'action'}:${action.label}`} className={`btn${action.primary || index === 0 ? '' : ' ghost'}`}
      onClick={() => action.run ? action.run() : open(action.target, action.billId)}>
      {action.label}{(action.primary || index === 0) && <Icon n="arrow" s={14} />}
    </button>
  ))}</div>;
}

/**
 * One card per decision, every card the same shape.
 *
 * The page used to lead with a headline figure four times the size of the sentence explaining it,
 * and that slot held a different kind of number on every alert — a posted charge on one, a
 * projected balance on the next, a goal shortfall on the third. Type that large promises the
 * number is the point, then means something new each time you look. The sentence is the point, so
 * the sentence is what is large; the figure sits beside it, small, with a label saying what it is.
 *
 * The first card is tinted rather than given a layout of its own, so the page reads as one list
 * with a top item instead of a feature and its leftovers.
 */
function AlertCard({ item, open, lead }) {
  const tone = item.tone === 'bad' ? 'bad' : 'warn';
  const figure = Number.isFinite(item.amount) ? formatAmount(item.amount) : item.metric;
  return <article className={`alert-card ${tone}${lead ? ' lead' : ''}`}>
    <span className="alert-card-icon"><Icon n={tone === 'bad' ? 'warn' : item.icon || 'up'} s={lead ? 20 : 17} /></span>
    <div className="alert-card-copy">
      <div className="alert-card-top">
        <h2>{item.title}</h2>
        {figure && <span className="alert-card-amount"><b className="num">{figure}</b><small>{item.metricLabel || 'needs a decision'}</small></span>}
      </div>
      <p>{item.body}</p>
      <AlertActions item={item} open={open} />
      {item.note && <p className="alert-card-note">{item.note}</p>}
    </div>
  </article>;
}

/** One queue for every decision the customer can actually clear. */
export default function AlertsPage({ h, sc = {}, alerts = [], reminders = [], leadDays, setLeadDays, onPaid,
  waiting = [], onReviewNotice, open }) {
  const actionable = alerts.filter(alert => alert.tone !== 'good').sort((a, b) => (rank[a.tone] ?? 2) - (rank[b.tone] ?? 2));
  const notices = waiting.map(notice => ({
    id: `notice:${notice.id}`, tone: 'warn', icon: 'mail', metric: '1', metricLabel: 'notice to review',
    title: 'A provider notice is waiting.',
    body: `${notice.originLabel}. It is not counted in your forecast until you review it.`,
    actions: [{ label: 'Review notice', primary: true, run: () => onReviewNotice(notice) }],
  }));
  const queue = [...actionable, ...notices];
  const nextPaycheck = (h.income || []).filter(item => item.date >= h.today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const countCopy = queue.length === 1 ? '1 thing needs you' : `${queue.length} things need you`;

  return <div className="alerts-page">
    <header className="alerts-heading">
      <div><h1>Alerts</h1></div>
      <p>{queue.length ? countCopy : 'Nothing needs you'}<span aria-hidden="true"> · </span><span>Plan date {planDate(h.today)}</span></p>
    </header>

    {queue.length ? <div className="alert-list">
      {queue.map((item, index) => <AlertCard key={item.id} item={item} lead={index === 0} open={open} />)}
    </div> : <section className="alerts-empty" aria-labelledby="alerts-empty-title">
      <span className="alerts-empty-icon"><Icon n="check" s={26} /></span>
      <div><h2 id="alerts-empty-title">Nothing needs you</h2>
        <p>{nextPaycheck ? `Next check-in when your paycheck lands ${prettyIso(nextPaycheck.date)}.` : 'We’ll check again when your plan changes.'}</p></div>
    </section>}

    <div className="alerts-secondary">
      <Reminders title="Bills due soon" reminders={reminders} leadDays={leadDays} setLeadDays={setLeadDays} onPaid={onPaid} />
      <BillReviewHistory reviews={sc.billReviews} open={open} />
    </div>
  </div>;
}
