const money = value => Math.round(value * 100) / 100;

export function transactionPage(rows, query = {}) {
  const integer = (value, fallback, min, max) => {
    if (value == null) return fallback;
    if (!/^\d+$/.test(String(value)) || Number(value) < min || Number(value) > max) throw new Error('Invalid pagination.');
    return Number(value);
  };
  const limit = integer(query.limit, 50, 1, 200), offset = integer(query.offset, 0, 0, 1000000);
  for (const value of [query.from, query.to].filter(v => v != null)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
      throw new Error('Use a valid YYYY-MM-DD date.');
  }
  if (query.from && query.to && query.from > query.to) throw new Error('The start date must precede the end date.');
  const kinds = ['income', 'transfer', 'refund', 'credit', 'withdrawal', 'bill', 'purchase'];
  if (query.kind && !kinds.includes(query.kind)) throw new Error('Unknown transaction kind.');
  const filtered = rows.filter(r => (!query.from || r.date >= query.from) && (!query.to || r.date <= query.to)
    && (!query.kind || r.kind === query.kind));
  const totals = Object.fromEntries(kinds.map(k => [k, money(filtered.filter(r => r.kind === k).reduce((sum, r) => sum + r.amount, 0))]));
  return { items: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit,
    nextOffset: offset + limit < filtered.length ? offset + limit : null, totals };
}
