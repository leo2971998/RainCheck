async function request(path, options = {}, env = process.env) {
  if (!/^https:\/\/[a-z]{20}\.supabase\.co\/?$/.test(env.SUPABASE_URL || '') || !env.SUPABASE_SECRET_KEY) throw new Error('Saved purchases unavailable');
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...options, headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error('Saved purchases unavailable');
    if (['23505', 'P0001'].includes(body.code)) error.status = 409;
    throw error;
  }
  return response.json();
}
export async function listPurchases() {
  const all = [];
  for (let offset = 0; offset <= 2000; offset += 500) {
    const page = await request(`raincheck_planned_purchases?workspace=eq.local-demo&select=id,revision,record,created_at,updated_at&order=created_at.asc,id.asc&offset=${offset}&limit=500`);
    all.push(...page); if (page.length < 500) break;
  }
  if (all.length > 2000) throw new Error('Saved purchase limit exceeded');
  return all.map(r => ({ ...r.record, id: r.id, revision: r.revision, createdAt: r.created_at, updatedAt: r.updated_at }));
}
export function savePurchase(id, revision, record) {
  const { id: ignoredId, revision: ignoredRevision, createdAt, updatedAt, ...data } = record;
  return request('rpc/raincheck_save_purchase', { method: 'POST', body: JSON.stringify({ p_id: id, p_expected: revision, p_record: data }) });
}
