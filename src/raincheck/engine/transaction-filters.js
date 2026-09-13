const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function sortTransactions(rows, sort = 'newest') {
  const newest = (a, b) => (b.date || '').localeCompare(a.date || '');
  return [...rows].sort((a, b) => {
    if (sort === 'amount-asc') return Math.abs(a.amt) - Math.abs(b.amt) || newest(a, b);
    if (sort === 'amount-desc') return Math.abs(b.amt) - Math.abs(a.amt) || newest(a, b);
    if (sort === 'review') return Number(!!b.note) - Number(!!a.note) || newest(a, b);
    return newest(a, b);
  });
}

export function dateBounds(preset, from = '', to = '', now = new Date()) {
  const year = now.getFullYear(), month = now.getMonth(), day = now.getDate();
  switch (preset) {
    case 'today': return [iso(now), iso(now)];
    case 'week': return [iso(new Date(year, month, day - 6)), iso(now)];
    case 'month': return [iso(new Date(year, month, 1)), iso(new Date(year, month + 1, 0))];
    case 'last-month': return [iso(new Date(year, month - 1, 1)), iso(new Date(year, month, 0))];
    case 'custom': return [from, to];
    default: return ['', ''];
  }
}

export function filterTransactions(rows, { kind = 'all', query = '', category = '', date = 'all', from = '', to = '', min = '', max = '' } = {}, now = new Date()) {
  const [start, end] = dateBounds(date, from, to, now);
  const search = query.trim().toLowerCase();
  return rows.filter(t => {
    const amount = Math.abs(t.amt);
    return (kind === 'all' || (kind === 'review' ? t.note : t.k === kind))
      && (!search || `${t.what} ${t.cat} ${t.d} ${t.date || ''} ${t.amt}`.toLowerCase().includes(search))
      && (!category || t.cat === category)
      && (!(start || end) || (t.date && (!start || t.date >= start) && (!end || t.date <= end)))
      && (min === '' || amount >= Number(min)) && (max === '' || amount <= Number(max));
  });
}
