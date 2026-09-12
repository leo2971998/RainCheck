// Server-only building blocks for the chatbot; not a public HTTP route.
// The caller must choose the dataset from its authorized session, never from an AI tool argument.
function checkDataset(dataset) {
  if (!['demo', 'backend'].includes(dataset)) throw new Error('Unknown dataset.');
}
function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
async function rpc(name, parameters, { env = process.env, request = fetch } = {}) {
  if (!/^https:\/\/[a-z]{20}\.supabase\.co\/?$/.test(env.SUPABASE_URL || '') || !env.SUPABASE_SECRET_KEY)
    throw new Error('Knowledge database configuration is incomplete.');
  try {
    const response = await request(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(parameters), signal: AbortSignal.timeout(10000), cache: 'no-store',
    });
    if (!response.ok) throw new Error('Request failed');
    return await response.json();
  } catch { throw new Error('Knowledge retrieval is unavailable. Please try again.'); }
}

/** Relevant evidence with native source IDs, a bounded excerpt count and explicit data dates. */
export async function searchKnowledge({ dataset, query, limit = 8 }, dependencies) {
  checkDataset(dataset);
  if (typeof query !== 'string' || query.trim().length < 1 || query.length > 500) throw new Error('Invalid search query.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('Invalid search limit.');
  return rpc('raincheck_search', { p_dataset: dataset, p_query: query.trim(), p_limit: limit }, dependencies);
}

/** Exact SQL sums over all matching posted records, not approximate sums over search hits. */
export async function activityTotals({ dataset, from, to, accountId = null }, dependencies) {
  checkDataset(dataset);
  if (!isDate(from) || !isDate(to) || from > to) throw new Error('Invalid activity date range.');
  if (accountId !== null && (typeof accountId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(accountId)))
    throw new Error('Invalid account.');
  return rpc('raincheck_activity_totals', { p_dataset: dataset, p_from: from, p_to: to, p_account_id: accountId }, dependencies);
}
