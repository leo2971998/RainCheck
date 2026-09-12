import { goalAt } from "./forecast.js";
const short = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function buildAlerts(h, sc, sim, cap, applied) {
  const out = [];
  const changed = h.recurring.find(r => r.change);
  const fits = sc.contribution <= cap;
  const g = goalAt(h, cap);
  if (changed && sc.increase > 0 && !applied) out.push({ tone: 'warn', title: `Your ${changed.label.toLowerCase()} bill increased by $${sc.increase}.`,
    body: [ !fits && `Your planned $${sc.contribution} contribution would leave $${Math.round(sim.low.balance)} on ${short(sim.low.date)}, below your $${h.cushion} cushion.`,
            g.gap && `Your goal would end $${g.gap} short.`, 'Review the effect on your goal.' ].filter(Boolean).join(' '),
    actions: ['bill', 'compare'] });
  else if (sim.worst === 'over' || sim.worst === 'below') out.push({ tone: 'bad', title: `Projected balance falls to $${Math.round(sim.low.balance)} on ${short(sim.low.date)}.`, body: `That is below your $${h.cushion} cushion before payday.` });
  if (applied) out.push({ tone: 'good', title: 'Plan updated.', body: `${applied.label}. Nothing was transferred.` });
  return out;
}
