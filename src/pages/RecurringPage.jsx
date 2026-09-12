import { Icon, Kpi, money, prettyIso, listOf } from '../components/ui.jsx';
import { amountFor, capacity, hypothetical, nextChargeDate, monthlyEquivalent } from '../engine/forecast.js';
import Discovered from '../components/Discovered.jsx';
import { budgetMoney } from '../components/BudgetImpact.jsx';

export default function RecurringPage({ h, sc, plan, change, cap, open, discovered = [], onAdopt, onDismiss }) {
  // Everything on this page is derived, so editing the increase or switching data sources can
  // never make the page say something false.
  const withDates = h.recurring.map(r => {
    const next = nextChargeDate(r, h.today);
    return {
      ...r, next,
      amount_now: amountFor(r, next, sc),
      perMonth: monthlyEquivalent(r, amountFor(r, next, sc)),
      cancelled: !!sc.cancelled?.[r.id],
      pending: !!sc.pendingCancel?.[r.id] && !sc.cancelled?.[r.id],
    };
  }).sort((a, b) => a.next.localeCompare(b.next));

  const total = withDates.filter(r => !r.cancelled).reduce((a, r) => a + r.perMonth, 0);
  const soonCutoff = new Date(new Date(h.today + 'T12:00:00').getTime() + 7 * 864e5).toISOString().slice(0, 10);
  const soon = withDates.filter(r => !r.cancelled && r.next <= soonCutoff);
  const changed = withDates.filter(r => r.change);
  const unexplained = withDates.filter(r => r.unexplained);
  const pending = withDates.filter(r => r.pending);

  const setNewPrice = (id, isNew) => change({ treatAsNewPrice: { [id]: isNew } }, `${id} marked ${isNew ? 'new price' : 'one-time'}`);
  const confirmCancelled = id => change({ cancelled: { [id]: true } }, 'Cancellation confirmed');
  const dropPending = id => change({ pendingCancel: { [id]: undefined } }, 'Cancellation withdrawn');
  const restore = id => change({ cancelled: { [id]: undefined } }, 'Commitment restored');

  return (
    <>
      <div className="topbar"><div><h1>Recurring</h1>
        <div className="sub">{withDates.length} commitments · {money(total)} per month · {changed.length ? `${changed.length} increase detected` : 'no increases detected'}</div></div>
        <div className="row wrap budget-actions"><button className="btn ghost sm" onClick={() => open('notice')}><Icon n="mail" s={14} />Import a notice</button>
          <button className="btn sm" onClick={() => open('subscription')}>Add subscription</button></div></div>

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Kpi label="Monthly recurring" value={money(total)} sub={`Across ${withDates.filter(r => !r.cancelled).length} commitments${withDates.some(r => r.everyMonths > 1) ? ", longer cycles counted per month" : ""}`} />
        <Kpi label="Due in the next 7 days" value={money(soon.reduce((a, r) => a + r.amount_now, 0))}
          sub={soon.length ? listOf(soon.map(r => `${r.label} ${prettyIso(r.next)}`)) : 'Nothing due this week'} />
        <Kpi label="Changes detected" value={String(changed.length)}
          sub={changed.length ? `${listOf(changed.map(r => r.label))} · confirmed from a notice` : 'No provider notices'}
          pill={changed.length ? <span className="pill warn"><Icon n="up" s={11} />{money(changed.reduce((a, r) => a + (r.change.increase ?? sc.increase), 0))}</span> : <span className="pill good">None</span>} />
        <Kpi label="Unexplained" value={String(unexplained.length)}
          sub={unexplained.length ? listOf(unexplained.map(r => `${r.label} posted ${money(r.lastPosted)}, usually ${money(r.usual ?? r.amount)}`)) : 'Every charge matched its usual amount'}
          pill={unexplained.length ? <span className="pill neutral">Needs a decision</span> : <span className="pill good">Clear</span>} />
      </div>

      {pending.length > 0 && (
        <div className="alert" style={{ marginBottom: 18 }}>
          <b>{listOf(pending.map(r => r.label))} {pending.length === 1 ? 'is' : 'are'} marked for cancellation, and still counted in your forecast.</b>
          <p>
            RainCheck will not assume a provider did what you asked. Until you confirm the cancellation went
            through, {pending.length === 1 ? 'it stays' : 'they stay'} in the plan. Confirming
            {pending.length === 1 ? ` frees ${money(capacity(h, hypothetical(sc, { cancelled: { [pending[0].id]: true } })) - cap)} a month` : ' updates the forecast'}.
          </p>
        </div>
      )}

      <div className="grid" style={{ gap: 18 }}>
      <div className="card">
        <div className="hd"><h2>Subscriptions in your budget</h2><span className="pill teal">Your estimates</span></div>
        <p>Explore new monthly costs here. Adding or removing one changes the forecast, not an actual subscription.</p>
        {withDates.some(r => r.budgetOnly) ? <ul className="budget-list">{withDates.filter(r => r.budgetOnly).map(r => <li key={r.id}>
          <div><b>{r.label}</b><span className="fine">{budgetMoney(r.amount)}/month · next {prettyIso(r.next)}</span></div>
          <button className="btn ghost sm" onClick={() => open('subscription', r.id)} aria-label={`Edit ${r.label}`}>Edit</button>
        </li>)}</ul> : <div className="fine">No extra subscriptions yet. Use “Add subscription” to preview one.</div>}
      </div>
      <Discovered found={discovered} onAdopt={onAdopt} onDismiss={onDismiss} />
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Commitment</th><th>Next</th><th>Frequency</th><th className="r">Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {withDates.filter(r => !r.budgetOnly).map(r => {
                const isNewPrice = !!sc.treatAsNewPrice?.[r.id];
                return (
                  <tr key={r.id} className="hover" style={{ opacity: r.cancelled ? 0.55 : 1 }}>
                    <td><div className="cat"><i className="rec"><Icon n="repeat" s={14} /></i><span style={{ fontWeight: 500 }}>{r.label}</span></div></td>
                    <td>{r.cancelled ? '—' : prettyIso(r.next)}</td>
                    <td className="muted">{r.freq || 'Monthly'}{r.everyMonths > 1 && <div className="fine">{money(r.perMonth)}/month equivalent</div>}</td>
                    <td className="r">{r.cancelled
                      ? <span className="muted" style={{ textDecoration: 'line-through' }}>{money(r.amount)}</span>
                      : r.amount_now !== r.amount
                        ? <><span className="muted" style={{ textDecoration: 'line-through' }}>{money(r.amount)}</span> <b>{money(r.amount_now)}</b></>
                        : money(r.amount)}</td>
                    <td>{
                      r.cancelled ? <span className="pill good"><Icon n="check" s={11} />Cancelled</span>
                      : r.pending ? <span className="pill warn">Cancellation pending · still counted</span>
                      : r.change ? <span className="pill warn"><Icon n="up" s={11} />Increase from notice</span>
                      : r.unexplained ? <span className="pill neutral">Posted {money(r.lastPosted)} {r.lastPostedDate ? `on ${prettyIso(r.lastPostedDate)} ` : ''}· not confirmed why</span>
                      : r.renews ? <span className="pill neutral">Renews {prettyIso(r.renews)}</span>
                      : <span className="pill good">Steady</span>
                    }</td>
                    <td className="r">
                      {r.change && <button className="btn sm" onClick={() => open('bill', r.id)}>Review</button>}
                      {r.pending && <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <button className="btn sm" onClick={() => confirmCancelled(r.id)}>It is cancelled</button>
                        <button className="btn ghost sm" onClick={() => dropPending(r.id)}>Never mind</button>
                      </div>}
                      {r.cancelled && <button className="btn ghost sm" onClick={() => restore(r.id)}>Restore</button>}
                      {r.unexplained && !r.cancelled && <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <button className={'btn sm' + (isNewPrice ? ' ghost' : '')} aria-pressed={!isNewPrice} onClick={() => setNewPrice(r.id, false)}>One-time</button>
                        <button className={'btn sm' + (isNewPrice ? '' : ' ghost')} aria-pressed={isNewPrice} onClick={() => setNewPrice(r.id, true)}>New price</button>
                      </div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="fine">
          {unexplained.length
            ? `"The amount changed. We have not confirmed why." is an honest state. Your decision on ${listOf(unexplained.map(r => r.label))} changes the forecast immediately.`
            : 'Every posted charge matched the amount we expected.'}
        </div>
      </div>
      </div>
    </>
  );
}
