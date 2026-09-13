import { useMemo } from 'react';
import { Icon, prettyIso } from '../components/ui.jsx';
import { budgetMoney as money } from '../components/BudgetImpact.jsx';
import { Sky, forecastWeather } from '../components/Weather.jsx';
import { Ambient } from '../components/Ambient.jsx';
import { weeklyBudget } from '../engine/weekly-budget.js';

export default function Dashboard({ h, sc, weekly, alerts = [], open, history, onUndo, dark = false }) {
  const calculated = useMemo(() => weekly || weeklyBudget(h, sc), [weekly, h, sc]);
  const w = calculated;
  const scene = dark ? 'night' : 'day';
  const goals = h.fundedGoals ?? [h.goal];
  const saved = h.savings ?? h.goal.saved;
  const target = goals.reduce((sum, g) => sum + g.target, 0);
  const progress = target > 0 ? Math.min(100, Math.floor(saved / target * 100)) : 0;
  const attention = alerts.filter(a => a.tone !== 'good').length;
  const lastAction = history?.at(-1);
  const monthlyNet = w.month ? w.month.income - w.month.spent : null;
  const weather = forecastWeather(w.state, monthlyNet < 0 ? [...alerts, { tone: 'warn' }] : alerts);
  const nextPay = (sc.income || h.income).filter(p => p.date >= h.today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const weekLabel = `${prettyIso(w.start)} – ${prettyIso(w.end)}`;
  return <div className="today-simple">
    <div className="today-heading"><div><h1>Today</h1><p>This week · {weekLabel}</p></div><span>Plan date: {prettyIso(h.today)}</span></div>
    <section className={'weather-hero weather-compact weekly-hero sky-' + scene} data-weather={weather} aria-label="This week’s spending">
      <Ambient state={weather} contained />
      <div className="weather-copy">
        <span className="weather-kicker">Left to spend this week</span>
        <div className="weekly-amount num">{money(w.available)}</div>
        {w.overspent > 0 ? <p className="weekly-warning" role="status"><b>{money(w.overspent)} over this week’s budget.</b> Review what changed and plan how to catch up.</p>
          : w.shortfall > 0 ? <p className="weekly-warning" role="status"><b>{money(w.shortfall)} more planned than available.</b> {w.state === 'over' ? 'Bills and spending need an adjustment.' : 'Adjust spending to protect bills and savings.'}</p>
          : monthlyNet < 0 ? <p className="weekly-warning">This month’s spending is ahead of income received.</p>
          : <p className="weekly-status">After setting room aside for bills, purchases and savings.</p>}
        <div className="weekly-budget-line">{w.spent != null ? <><b>{money(w.spent)}</b> spent · </> : null}<b>{money(w.budget)}</b> weekly budget{w.overspent > 0 && <> · {money(w.overspent)} over budget</>}</div>
        <div className="weekly-hero-footer"><button className="btn weather-action" onClick={() => open(w.overspent > 0 || monthlyNet < 0 ? 'page:cashflow' : 'week-budget')}>{w.overspent > 0 || monthlyNet < 0 ? 'Review spending & savings' : w.shortfall > 0 ? 'Review this week' : 'View weekly budget'} <Icon n="arrow" s={15} /></button>
          {attention > 0 && <button className="weekly-alert-link" onClick={() => open('page:alerts')}><Icon n="bell" s={15} />{`${attention} alert${attention === 1 ? '' : 's'} to review`} <Icon n="arrow" s={14} /></button>}</div>
      </div>
      <div className="hero-weather"><Sky state={weather} night={dark} /></div>
    </section>
    <div className="today-widgets" aria-label="Your money at a glance">
      <Widget title="Money this month" icon="bars" warning={monthlyNet < 0} action="Review transactions" onClick={() => open('page:transactions')}
        value={monthlyNet == null ? money(h.checking) : money(Math.abs(monthlyNet))}
        subtitle={monthlyNet == null ? 'In checking' : monthlyNet >= 0 ? 'Income left after spending' : 'Spending exceeds income received'}>
        {w.month && <><span>{money(w.month.spent)} spent of {money(w.month.income)} received</span><progress aria-label="Recorded income spent this month" value={w.month.income > 0 ? Math.min(w.month.spent, w.month.income) : 0} max={Math.max(1, w.month.income)} /></>}
        <small>{money(h.checking)} in checking · {prettyIso(h.today)}</small>
      </Widget>
      <Widget title="This week’s bills" icon="repeat" action="View bills" onClick={() => open('page:recurring')}
        value={money(w.billsTotal)} subtitle={w.bills.length ? `${w.bills.length} bill${w.bills.length === 1 ? '' : 's'} due` : 'No bills scheduled'}>
        <span className="widget-names">{w.bills.map(b => b.label).join(' · ') || 'Nothing due before Sunday'}</span>
      </Widget>
      <Widget title="Savings" icon="target" action="Spending & Savings" onClick={() => open('page:cashflow')}
        value={money(saved)} subtitle={`${goals.length} goal${goals.length === 1 ? '' : 's'} · one savings account`}>
        <span className="widget-names">{goals.map(g => g.label).join(' · ') || 'Add something to save for'}</span>
        {target > 0 && <><progress aria-label="Combined savings progress" value={Math.min(saved, target)} max={target} /><small>{progress}% saved · {money(target)} combined target</small></>}
      </Widget>
      <Widget title="Next income" icon="trend" action="See weekly budget" onClick={() => open('week-budget')}
        value={nextPay ? money(nextPay.amount) : 'Not scheduled'} subtitle={nextPay ? `Expected ${prettyIso(nextPay.date)}` : 'No expected paycheck found'}>
        <span>Not counted as money already received</span>
      </Widget>
      <Widget title="Alerts" icon="bell" warning={attention > 0} action="View alerts" onClick={() => open('page:alerts')}
        value={attention ? `${attention} to review` : 'All clear'} subtitle={attention ? 'Needs your decision' : 'No action needed'} />
      <Widget title="Planned purchases" icon="cart" action="Plan a purchase" onClick={() => open('page:purchases')}
        value={money(w.purchasesTotal)} subtitle={w.purchases.length ? `${w.purchases.length} planned this week` : 'No purchases planned this week'}>
        {w.purchases.length > 0 && <span className="widget-names">{w.purchases.map(p => p.label).join(' · ')}</span>}
      </Widget>
    </div>
    {lastAction && <div className="today-undo"><span>{lastAction.label}</span><button className="link" onClick={onUndo}>Undo</button></div>}
  </div>;
}

function Widget({ title, icon, value, subtitle, action, onClick, children, warning = false }) {
  return <button type="button" className={'today-widget' + (warning ? ' is-warning' : '')} onClick={onClick}>
    <span className="widget-heading"><i><Icon n={icon} s={19} /></i><span>{title}</span></span>
    <b className="widget-value num">{value}</b>
    <span className="widget-subtitle">{subtitle}</span>
    {children && <span className="widget-body">{children}</span>}
    <span className="widget-action">{action}<Icon n="arrow" s={15} /></span>
  </button>;
}
