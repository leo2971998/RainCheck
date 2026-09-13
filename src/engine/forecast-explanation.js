const round = n => Math.round(n * 100) / 100;

export function checkingBreakdown(h, sim) {
  const end = sim.days.findIndex(d => d.key === sim.low.key);
  const events = sim.days.slice(0, end + 1).flatMap(d => d.events);
  const rows = [{ label: 'Starting checking balance', amount: h.checking },
    ...[['pay', 'Expected income'], ['bill', 'Scheduled bills'], ['everyday', 'Estimated everyday spending'],
      ['purchase', 'Planned purchases'], ['transfer', 'Monthly goal savings']]
      .map(([flag, label]) => ({ label, amount: round(events.filter(e => e[flag]).reduce((s, e) => s + e.amt, 0)) }))];
  const rounding = round(sim.low.balance - rows.reduce((s, r) => s + r.amount, 0));
  if (rounding) rows.push({ label: 'Rounding', amount: rounding });
  return rows;
}

// Aggregate calculation evidence only: no account identifiers, raw transactions or private notes.
// Kept within the existing ZeroClaw evidence contract; it explains, never replaces, the engine.
export function forecastEvidenceDocuments(h, sim) {
  const evidence = h.spendingEvidence;
  if (!evidence || h.spendingModel) return [];
  const rows = checkingBreakdown(h, sim);
  return [
    { title: 'How everyday spending is estimated', asOf: h.today,
      text: `${evidence.lookbackDays}-day lookback. Records found ${evidence.from || 'not available'} to ${evidence.through || 'not available'}. Usual spending uses the median recorded category totals in elapsed months (${(evidence.baselineMonths || []).join(', ')}); partial-only categories are provisional. Baseline $${evidence.monthly}/month; current plan $${sim.monthlySpend}/month. Calendar-day allocation, not a learned weekly pattern. Explicit event-ticket purchases are excluded from the usual baseline. Bills and monthly goal savings are separate. No inferred annual seasonality. ${evidence.categories.slice(0, 5).map(c => `${c.label}: $${c.monthly}/month.`).join(' ')}`.slice(0, 700) },
    { title: 'Why checking reaches its lowest estimated balance', asOf: h.today,
      text: `SAVED PLAN, not a preview or live balance. From ${h.today} through ${sim.low.key}: ${rows.map(r => `${r.label}: ${r.amount}`).join('; ')}. End-of-day checking: $${sim.low.balance}. Checking buffer: $${h.cushion}. Values are USD. These are scheduled or estimated future events, not charges already made. Use only these calculator totals; do not invent a cause, seasonality or a guarantee.`.slice(0, 700) },
  ];
}
