import { expect, it, vi } from 'vitest';
import { consumeChatLimit } from '../api/_chat-access.js';
const env={SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_SECRET_KEY:'test-db',RAINCHECK_CHAT_RATE_SECRET:'test-secret-that-is-at-least-32-characters'};
const req={headers:{'x-vercel-forwarded-for':'203.0.113.5'}};
it('stores only a keyed fingerprint, not a raw address, in the shared quota',async()=>{
  const request=vi.fn(async()=>({ok:true,json:async()=>({allowed:true,retryAfter:0})}));
  expect(await consumeChatLimit(req,'session',env,request)).toEqual({allowed:true,retryAfter:0});
  const body=JSON.parse(request.mock.calls[0][1].body);
  expect(body.p_subject).toMatch(/^[a-f0-9]{64}$/);expect(body.p_kind).toBe('session');
  expect(request.mock.calls[0][1].body).not.toContain('203.0.113.5');
});
it('rejects missing or spoofed address chains and malformed quota responses',async()=>{
  const request=vi.fn();
  for(const headers of [{},{'x-forwarded-for':'203.0.113.5'},{'x-vercel-forwarded-for':'203.0.113.5, 1.2.3.4'}])
    await expect(consumeChatLimit({headers},'session',env,request)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
  for(const result of [{},{allowed:true},{allowed:false,retryAfter:-1},{allowed:true,retryAfter:999999}])
    await expect(consumeChatLimit(req,'context',env,async()=>({ok:true,json:async()=>result}))).rejects.toThrow();
});
