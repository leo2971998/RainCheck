import { describe, expect, it } from 'vitest';
import { searchKnowledge, activityTotals } from '../api/_knowledge.js';

const env = { SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_SECRET_KEY: 'test-secret' };
describe('server-side knowledge retrieval', () => {
  it('sends a bounded search to the fixed RPC without placing credentials in its URL', async () => {
    let request;
    const rows = [{ source_type: 'deposit', source_id: 'd1', body: 'Payroll', as_of: '2026-09-28' }];
    const result = await searchKnowledge({ dataset: 'demo', query: 'payroll', limit: 5 }, { env,
      request: async (url, options) => { request = { url, options }; return Response.json(rows); } });
    expect(result).toEqual(rows);
    expect(request.url).toBe(`${env.SUPABASE_URL}/rest/v1/rpc/raincheck_search`);
    expect(JSON.parse(request.options.body)).toEqual({ p_dataset: 'demo', p_query: 'payroll', p_limit: 5 });
    expect(request.options.headers.apikey).toBe('test-secret');
  });
  it('rejects unknown datasets, excessive search sizes, and invalid date ranges before requesting data', async () => {
    const dependencies = { env, request: () => { throw new Error('should not fetch'); } };
    await expect(searchKnowledge({ dataset: 'someone-else', query: 'payroll' }, dependencies)).rejects.toThrow('dataset');
    await expect(searchKnowledge({ dataset: 'demo', query: 'a'.repeat(501) }, dependencies)).rejects.toThrow('query');
    await expect(searchKnowledge({ dataset: 'demo', query: 'payroll', limit: 500 }, dependencies)).rejects.toThrow('limit');
    await expect(activityTotals({ dataset: 'demo', from: '2026-02-30', to: '2026-09-01' }, dependencies)).rejects.toThrow('date');
    await expect(activityTotals({ dataset: 'demo', from: '2026-09-02', to: '2026-09-01' }, dependencies)).rejects.toThrow('date');
  });
  it('does not expose database error messages or credentials to a caller', async () => {
    await expect(searchKnowledge({ dataset: 'demo', query: 'rent' }, { env,
      request: async () => new Response('private database detail and test-secret', { status: 403 }) }))
      .rejects.toThrow('Knowledge retrieval is unavailable');
  });
  it('requires server configuration and never sends a key to an arbitrary host', async () => {
    await expect(searchKnowledge({ dataset: 'demo', query: 'rent' }, { env: { ...env, SUPABASE_URL: 'https://example.com' } }))
      .rejects.toThrow('configuration');
  });
});
