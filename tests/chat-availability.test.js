import { expect, it } from 'vitest';
import { loadChatAvailability } from '../src/chat/availability.js';
it('recognizes an enabled public demo without server-start instructions',async()=>{
  const result=await loadChatAvailability(async()=>({ok:true,json:async()=>({available:true,publicDemo:true})}));
  expect(result).toMatchObject({available:true,publicDemo:true});
});
it('distinguishes a disabled version from a connection failure',async()=>{
  const disabled=await loadChatAvailability(async()=>({ok:true,json:async()=>({available:false})}));
  expect(disabled.message).toContain('not available on this version');
  for(const request of [async()=>{throw new Error('private error');},async()=>({ok:false}),async()=>({ok:true,json:async()=>({})})]) {
    const result=await loadChatAvailability(request); expect(result.available).toBe(false);
    expect(result.message).toContain('Try again'); expect(result.message).not.toMatch(/private|server|locally/);
  }
});
