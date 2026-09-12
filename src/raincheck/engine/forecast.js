// src/engine/forecast.js
export const iso = d => d.toISOString().slice(0, 10);
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const stateOf = (b, cushion) => b < 0 ? 'over' : b < cushion ? 'below' : b < cushion + 100 ? 'tight' : 'ok';

export function simulate(h, sc) {
  const income = sc.income || h.income;
  const start = new Date(h.today + 'T12:00:00');               // noon avoids DST edge cases
  const contributionDate = income.map(p => p.date).filter(d => d >= h.today).sort()[0]; // first payday
  const dailySpend = h.allowances.reduce((a, x) => a + x.monthly - (sc.cuts?.[x.id] || 0), 0) / 30;

  const days = []; let b = h.checking;
  for (let i = 0; i < h.windowDays; i++) {
    const date = addDays(start, i), key = iso(date), events = [];

    for (const p of income) if (p.date === key) { b += p.amount; events.push({ label: p.label, amt: p.amount, pay: true }); }

    for (const r of h.recurring) {
      if (date.getDate() !== r.day || sc.cancelled?.[r.id]) continue;
      let amt = r.amount;
      if (r.change && key >= r.change.effective) amt = r.amount + sc.increase;
      if (r.id === 'electric' && sc.treatElectricAsNew) amt = r.lastPosted;
      b -= amt; events.push({ label: r.label, amt: -amt, bill: true, big: amt >= 100 });
    }

    if (key === contributionDate && sc.contribution > 0) { b -= sc.contribution; events.push({ label: 'Savings contribution', amt: -sc.contribution, transfer: true }); }

    b -= dailySpend; events.push({ label: 'Everyday spending', amt: -dailySpend });
    days.push({ date, key, balance: b, events, state: stateOf(b, h.cushion) });
  }

  const low = days.reduce((a, x) => (x.balance < a.balance ? x : a));
  const worst = ['over', 'below', 'tight', 'ok'].find(s => days.some(d => d.state === s));
  const month = days.filter(d => d.key.slice(0, 7) === days[days.length - 1].key.slice(0, 7)); // the last month in the window
  const cash = {
    income: month.reduce((a, d) => a + d.events.filter(e => e.pay).reduce((s, e) => s + e.amt, 0), 0),
    bills: month.reduce((a, d) => a + d.events.filter(e => e.bill).reduce((s, e) => s - e.amt, 0), 0),
    everyday: Math.round(month.length * dailySpend),
    savings: sc.contribution,
  };
  return { days, low, worst, dailySpend, cash, contributionDate };
}

export function capacity(h, sc, max = 600, step = 5) {
  for (let c = max; c >= 0; c -= step)
    if (simulate(h, { ...sc, contribution: c }).low.balance >= h.cushion) return c;
  return 0;
}

export function goalAt(h, c, left = h.goal.left) {
  const projected = h.goal.saved + left * c;
  const gap = Math.max(0, h.goal.target - projected);
  const monthsNeeded = c > 0 ? Math.ceil((h.goal.target - h.goal.saved) / c) : Infinity;
  return { projected, gap, monthsNeeded, contributions: left * c, left };
}

export function cutNeeded(h, sc, allowanceId, want) {
  for (let cut = 0; cut <= 400; cut += 5)
    if (capacity(h, { ...sc, cuts: { ...sc.cuts, [allowanceId]: cut } }) >= want) return cut;
  return null;
}
