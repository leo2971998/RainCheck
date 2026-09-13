import { expect, it, vi } from 'vitest';
import { createSessionHandler } from '../api/chat-session.js';
import { createContextHandler } from '../api/chat-context.js';
import { localReviewAllowed } from '../api/_local-workspace.js';
import { household as base } from '../data/household.sample.js';
import { householdVersion } from '../api/_review.js';
import { emptyPlan } from '../src/engine/plan.js';

const origin = 'https://raincheck-planner.vercel.app';
const env = { VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production', RAINCHECK_PUBLIC_CHAT: '1',
  RAINCHECK_CHAT_ORIGIN: origin, RAINCHECK_CHAT_RATE_SECRET: 'test-only-rate-secret-with-32-characters',
  ELEVENLABS_API_KEY: 'test-key', ELEVENLABS_AGENT_ID: 'agent_test',
  SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_SECRET_KEY: 'test-db-key' };
const req = body => ({ method: 'POST', body, headers: { host: 'raincheck-planner.vercel.app', origin,
  'content-type': 'application/json', 'x-vercel-forwarded-for': '203.0.113.7' }, socket: { remoteAddress: '10.0.0.1' } });
const res = () => ({ statusCode: 200, headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.statusCode=n;return this; }, json(body) { this.body=body;return this; } });
const signed = () => ({ ok: true, json: async () => ({ signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?signature=test' }) });

it('opens an explicitly enabled public demo without enabling bank writes or local AI review', async () => {
  const limit = vi.fn(async () => ({ allowed: true })), request = vi.fn(async () => signed()), out = res();
  await createSessionHandler({ env, request, limit })(req({ consent: true }),out);
  expect(out.statusCode).toBe(200); expect(out.body.signedUrl).toContain('wss://api.elevenlabs.io/');
  expect(limit).toHaveBeenCalledOnce(); expect(JSON.stringify(out.body)).not.toContain(env.ELEVENLABS_API_KEY);
  expect(localReviewAllowed(req({}), { ...env, RAINCHECK_AI_LOCAL: '1' })).toBe(false);
});

it('keeps disabled, preview, foreign-origin, wrong-host and incomplete public setups closed', async () => {
  const request = vi.fn(), limit = vi.fn();
  for (const [config, input] of [
    [{...env,RAINCHECK_PUBLIC_CHAT:'0'},req({consent:true})],
    [{...env,VERCEL_ENV:'preview'},req({consent:true})],
    [{...env,RAINCHECK_CHAT_RATE_SECRET:''},req({consent:true})],
    [{...env,SUPABASE_SECRET_KEY:''},req({consent:true})],
    [env,{...req({consent:true}),headers:{...req().headers,origin:'https://evil.example'}}],
    [env,{...req({consent:true}),headers:{...req().headers,host:'other.vercel.app'}}],
    [env,req({consent:false})],
  ]) { const out=res(); await createSessionHandler({env:config,request,limit})(input,out); expect(out.statusCode).toBeGreaterThanOrEqual(400); }
  expect(request).not.toHaveBeenCalled(); expect(limit).not.toHaveBeenCalled();
});

it('enforces the shared quota and fails closed when the quota service fails', async () => {
  const request=vi.fn();
  const limited=res(); await createSessionHandler({env,request,limit:async()=>({allowed:false,retryAfter:60})})(req({consent:true}),limited);
  expect(limited.statusCode).toBe(429); expect(limited.headers['Retry-After']).toBe('60');
  const failed=res(); await createSessionHandler({env,request,limit:async()=>{throw new Error('private database detail');}})(req({consent:true}),failed);
  expect(failed.statusCode).toBe(503); expect(JSON.stringify(failed.body)).not.toContain('private database');
  expect(request).not.toHaveBeenCalled();
});

it('reports public availability without creating a billable session', async () => {
  const request=vi.fn(), limit=vi.fn(), out=res();
  await createSessionHandler({env,request,limit})({...req(),method:'GET'},out);
  expect(out.body).toMatchObject({available:true,publicDemo:true});
  expect(request).not.toHaveBeenCalled(); expect(limit).not.toHaveBeenCalled();
});

it('uses the public dashboard dataset without reading local saved purchases', async () => {
  const load=vi.fn(async()=>({base,snapshot:{}})), retrieve=vi.fn(async()=>({status:'matched',evidence:[]})), limit=vi.fn(async()=>({allowed:true}));
  const out=res();
  await createContextHandler({env,load,retrieve,limit})(req({consent:true,baseVersion:householdVersion(base),plan:emptyPlan(),tool:'get_current_plan',args:{}}),out);
  expect(out.statusCode).toBe(200); expect(load).toHaveBeenCalledWith({dataset:'demo',purchases:false});
  expect(out.body.impact.after.low).toBe(217.19); expect(limit).toHaveBeenCalledOnce();
});

it('rejects public writes and oversized inputs before loading bank records', async () => {
  const load=vi.fn(), limit=vi.fn(async()=>({allowed:true})), retrieve=vi.fn();
  const handler=createContextHandler({env,load,limit,retrieve});
  const out=res(); await handler({...req({}),method:'DELETE'},out); expect(out.statusCode).toBe(405);
  const large=res(); await handler(req({consent:true,notes:'x'.repeat(17000)}),large); expect(large.statusCode).toBe(413);
  expect(load).not.toHaveBeenCalled(); expect(limit).not.toHaveBeenCalled();
});
