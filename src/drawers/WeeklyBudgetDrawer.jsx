import Drawer, { DrawerHeader } from '../components/Drawer.jsx';
import { prettyIso } from '../components/ui.jsx';
import { budgetMoney as money } from '../components/BudgetImpact.jsx';

export default function WeeklyBudgetDrawer({ h, weekly: w, open, onClose }) {
  const nextPay = (h.income || []).filter(p => p.date >= h.today).sort((a, b) => a.date.localeCompare(b.date))[0];
  return <Drawer label="Your weekly budget" onClose={onClose}>
    <DrawerHeader title="Your weekly budget" icon="bars" onClose={onClose} />
    <p>{prettyIso(w.start)} – {prettyIso(w.end)} · plan dated {prettyIso(h.today)}</p>
    <div className="weekly-drawer-total"><span>Left to spend</span><strong className="num">{money(w.available)}</strong>
      {w.shortfall > 0 && <p>{money(w.shortfall)} more planned than available. Review a purchase or your savings amount before spending more.</p>}</div>
    <dl className="forecast-breakdown">
      <div><dt>Usual budget for this week</dt><dd>{money(w.budget)}</dd></div>
      <div><dt>Already spent this week</dt><dd>{w.spent == null ? 'Records unavailable' : money(w.spent)}</dd></div>
      <div><dt>Upcoming bills this week</dt><dd>{money(w.billsTotal)}</dd></div>
      <div><dt>Planned purchases this week</dt><dd>{money(w.purchasesTotal)}</dd></div>
      <div><dt>Goal savings planned this week</dt><dd>{money(w.savings)}</dd></div>
    </dl>
    {nextPay && <section><h3>Next expected income</h3><p><b>{money(nextPay.amount)}</b> · {prettyIso(nextPay.date)} <span className="fine">· Not received yet</span></p></section>}
    <p className="fine">Bills, planned purchases, savings and your {money(h.cushion)} checking buffer are kept out of spending money. A future paycheck is not available before it arrives. This is a conservative weekly estimate, not a bank spending limit.</p>
    {!!w.bills.length && <section><h3>Bills coming up</h3><ul className="weekly-drawer-list">{w.bills.map(b => <li key={b.id + b.date}><span>{b.label} · {prettyIso(b.date)}</span><b>{money(-b.amt)}</b></li>)}</ul></section>}
    {!!w.purchases.length && <section><h3>Your planned purchases</h3><ul className="weekly-drawer-list">{w.purchases.map(p => <li key={p.id}><span>{p.label} · {prettyIso(p.date)}</span><b>{money(-p.amt)}</b></li>)}</ul></section>}
    <div className="grid" style={{ gap: 10 }}>
      <button className="btn" onClick={() => open('page:purchases')}>Review planned purchases</button>
      <button className="btn ghost" onClick={() => open('page:goals')}>Review savings plan</button>
      <button className="btn ghost" onClick={() => open('page:recurring')}>Review bills</button>
    </div>
    <p className="fine">Changes need your confirmation. No money moves here.</p>
  </Drawer>;
}
