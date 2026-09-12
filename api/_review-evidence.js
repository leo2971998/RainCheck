import { prepareKnowledge } from '../scripts/supabase-knowledge.mjs';
import { searchKnowledge } from './_knowledge.js';

/** Search is evidence, not arithmetic. Only a byte-equivalent bank import can join a forecast. */
export async function retrieveReviewEvidence(snapshot, question, { env = process.env, request = fetch, search = searchKnowledge } = {}) {
  if (!/^https:\/\/[a-z]{20}\.supabase\.co\/?$/.test(env.SUPABASE_URL || '') || !env.SUPABASE_SECRET_KEY)
    return { status: 'unavailable', evidence: [] };
  const prepared = prepareKnowledge(snapshot, { dataset: 'demo', asOf: snapshot.asOf });
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/raincheck_snapshots?dataset_id=eq.demo&fingerprint=eq.${prepared.fingerprint}&select=id,as_of,synced_at&limit=1`;
  const response = await request(url, { headers: { apikey: env.SUPABASE_SECRET_KEY }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok) throw new Error('Evidence unavailable');
  const [match] = await response.json();
  if (!match) return { status: 'outdated', evidence: [] };
  // Small, transparent full-text retrieval; not an embedding or model-training system.
  const query = question.replace(/[^a-zA-Z0-9 -]/g, ' ').trim();
  let rows = await search({ dataset: 'demo', query: query || 'payroll', limit: 4 });
  if (!rows.length) rows = await search({ dataset: 'demo', query: 'payroll OR paycheck', limit: 4 });
  const evidence = rows.filter(r => r.snapshot_id === match.id && r.as_of === snapshot.asOf).slice(0, 4).map(r => ({
    title: r.title.slice(0, 120), text: r.body.slice(0, 700), asOf: r.as_of,
    recordDate: r.record_date, documentId: r.document_id, syncedAt: r.synced_at,
  }));
  return { status: evidence.length ? 'matched' : 'no-matches', evidence };
}
