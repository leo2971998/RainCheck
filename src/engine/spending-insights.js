const round = value => Math.round(value * 100) / 100;
const monthDays = key => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5)), 0)).getUTCDate();
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : 0;
};

/** Observed spending and optional pace estimates. Never interprets a larger purchase as wrongdoing. */
export function spendingInsights(h, sc = {}, protectedIds = {}) {
  const month = h.today.slice(0, 7), elapsed = Number(h.today.slice(8)), days = monthDays(month);
  const evidence = h.spendingEvidence;
  const available = evidence?.asOf === h.today && !!evidence?.months?.length;
  const complete = evidence?.baselineMonths || [];
  const categories = h.allowances.map(a => {
    const source = evidence?.categories.find(c => c.id === a.id);
    const current = source?.months.find(m => m.key === month);
    const oneOff = round((evidence?.oneOffs || []).filter(o => o.category === a.label && o.date.startsWith(month)).reduce((s, o) => s + o.amount, 0));
    const spent = available && !a.reclaimed ? round(current?.spent ?? ((current?.total || 0) + oneOff)) : null;
    const budget = round(Math.max(0, a.monthly - (sc.cuts?.[a.id] || 0)));
    const past = (source?.months || []).filter(m => complete.includes(m.key) && m.total > 0);
    const ratios = past.filter(m => m.daily?.length).map(m => {
      const cutoff = Math.floor(elapsed / days * monthDays(m.key));
      return m.daily.filter(d => d.day <= cutoff).reduce((s, d) => s + d.amount, 0) / m.total;
    });
    const fraction = ratios.length >= 2 ? median(ratios) : elapsed / days;
    const enough = available && elapsed >= Math.ceil(days * .3) && past.length >= 2 && (current?.regularCount || 0) >= 3 && fraction >= .1 && !a.reclaimed;
    const projected = enough ? round((current.total / fraction) + oneOff) : null;
    const over = spent == null ? 0 : round(Math.max(0, spent - budget));
    const averagePurchase = source?.count ? round(source.total / source.count) : null;
    const protect = protectedIds[a.id] === true;
    const uncertain = /\bcash|\bother\b|unclassified|unknown/i.test(a.label) || !!a.reclaimed;
    // A small, explicitly optional trial, bounded by observed purchase size. It is not an optimality claim.
    const suggestedCut = !protect && !uncertain && past.length >= 2 && averagePurchase > 0
      ? round(Math.min(budget * .2, averagePurchase)) : 0;
    return { id: a.id, label: a.label, usual: a.monthly, budget, spent, oneOff, count: current?.count ?? null,
      remaining: spent == null ? null : round(Math.max(0, budget - spent)), over, projected,
      expectedByNow: round(budget * fraction), timing: ratios.length >= 2 ? 'history' : 'linear',
      status: !available ? 'unavailable' : a.reclaimed ? 'reclassified' : over > 0 ? 'over' : elapsed < Math.ceil(days * .3) ? 'early'
        : !enough ? 'limited' : projected > budget * 1.15 && projected - budget >= 10 ? 'pace' : 'within',
      averagePurchase, protected: protect, suggestedCut, months: source?.months || [],
      completeMonths: past.length, provisional: !source || source.provisional || past.length < 2 };
  });
  const sum = key => round(categories.reduce((s, c) => s + (c[key] || 0), 0));
  const comparable = available && categories.every(c => c.spent != null);
  return { month, asOf: h.today, elapsed, days, daysLeft: days - elapsed, available, categories,
    spent: comparable ? sum('spent') : null, budget: sum('budget'),
    remaining: comparable ? round(Math.max(0, sum('budget') - sum('spent'))) : null,
    totalRecorded: h.activity?.asOf === h.today ? h.activity.month.spent : null,
    sourceFrom: evidence?.from, sourceThrough: evidence?.through,
    historyMonths: complete.length, attention: categories.filter(c => ['over', 'pace'].includes(c.status)).length };
}
