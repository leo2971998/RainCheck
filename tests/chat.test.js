import { expect, it, vi } from 'vitest';
import { createSessionHandler } from '../api/chat-session.js';
import { calculateChat } from '../api/_chat.js';
import { household as base } from '../data/household.sample.js';
import { emptyPlan } from '../src/engine/plan.js';
import { householdVersion } from '../api/_review.js';
import { budgetImpact } from '../src/engine/budget.js';
import { createContextHandler } from '../api/chat-context.js';
import { receiveMessage } from '../src/chat/messages.js';
import { chatBrief } from '../src/chat/brief.js';
const env={RAINCHECK_AI_LOCAL:'1',ELEVENLABS_API_KEY:'secret-for-test',ELEVENLABS_AGENT_ID:'agent_test'};
it('keeps one assistant message when streaming is followed by the final answer',()=>{
  let messages=[{id:'user-1',role:'user',text:'What if?'}];
  for(const part of [{type:'start',text:'',event_id:1},{type:'delta',text:'A $25',event_id:1},{type:'delta',text:' increase.',event_id:1},{type:'stop',text:'',event_id:1},{text:'A $25 increase.',event_id:1}]) messages=receiveMessage(messages,part);
  expect(messages).toHaveLength(2);expect(messages[1]).toMatchObject({text:'A $25 increase.',streaming:false});
  expect(receiveMessage(messages,{event_id:2,text:'A follow-up.'})).toHaveLength(3);
});
it('does not display empty pre-tool messages or discard a streamed answer',()=>{
  expect(receiveMessage([],{event_id:1,text:'',type:'start'})).toEqual([]);
  expect(receiveMessage([],{event_id:1,text:''})).toEqual([]);
  const messages=receiveMessage([],{event_id:1,text:'Hello',type:'delta'});
  expect(receiveMessage(messages,{event_id:1,text:''})[0].text).toBe('Hello');
});
const req=body=>({method:'POST',body,headers:{host:'127.0.0.1:5176',origin:'http://127.0.0.1:5176','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}});
const res=()=>({statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}});
it('requires consent and local same-origin access before creating a chat session', async()=>{
  const request=vi.fn(); const handler=createSessionHandler({env,request});
  for(const r of [req({consent:false}),{...req({consent:true}),headers:{host:'127.0.0.1:5176',origin:'https://evil.example'}}]){
    const out=res();await handler(r,out);expect(out.statusCode).toBeGreaterThanOrEqual(400);
  }
  const out=res();await createSessionHandler({env:{...env,VERCEL:'1'},request})(req({consent:true}),out);
  expect(out.statusCode).toBe(403);expect(request).not.toHaveBeenCalled();
});
it('returns a temporary signed URL without the API key and hides upstream failures',async()=>{
  const request=vi.fn(async()=>({ok:true,json:async()=>({signed_url:'wss://api.elevenlabs.io/v1/convai/conversation?signature=test'})}));
  const out=res();await createSessionHandler({env,request})(req({consent:true}),out);
  expect(out.body.signedUrl).toContain('wss://api.elevenlabs.io/');expect(JSON.stringify(out.body)).not.toContain(env.ELEVENLABS_API_KEY);
  const fail=res();await createSessionHandler({env,request:async()=>{throw new Error(env.ELEVENLABS_API_KEY)}})(req({consent:true}),fail);
  expect(fail.statusCode).toBe(503);expect(JSON.stringify(fail.body)).not.toContain(env.ELEVENLABS_API_KEY);
});
const body=(tool,args={})=>({consent:true,baseVersion:householdVersion(base),plan:emptyPlan(),tool,args});
it('gets current calculator results, not numbers supplied by the agent',()=>{
  const result=calculateChat(base,body('get_current_plan'));
  expect(result.impact.after).toEqual(budgetImpact(base,emptyPlan(),{}).after);
  expect(result.bills.find(b=>b.id==='electric').estimate).toBe(110);
  expect(result).not.toHaveProperty('plan');expect(result).not.toHaveProperty('checkingId');
});
it('previews by versus to distinctly without applying a decision',()=>{
  const by=body('preview_bill',{billId:'internet',amount:25,change:'by'}); const original=JSON.stringify(by);
  const result=calculateChat(base,by);
  expect(result.preview.amount).toBe(90);expect(result.preview.applied).toBe(false);
  expect(result.impact.after.monthlyBills-result.impact.before.monthlyBills).toBe(25);
  expect(JSON.stringify(by)).toBe(original);
  expect(calculateChat(base,body('preview_bill',{billId:'internet',amount:25,change:'to'})).preview.amount).toBe(25);
});
it('explains calculator fields to the agent in plain language, without misleading state codes',()=>{
  const result=calculateChat(base,body('preview_bill',{billId:'internet',amount:25,change:'by'}));
  const brief=chatBrief(result);
  expect(brief).toContain('lowest checking balance $192.19');
  expect(brief).toContain('NOT fully supported');expect(brief).toContain('not how long money lasts');
  expect(brief).not.toMatch(/fits:|feasible:|state:|"before"|"after"/);
  expect(brief).toContain('No change has been saved or paid');
});
it('previews a new monthly cost and rejects stale data, invented bills and unsafe arguments',()=>{
  expect(calculateChat(base,body('preview_monthly_cost',{amount:20})).impact.after.monthlyBills).toBe(budgetImpact(base,emptyPlan(),{}).after.monthlyBills+20);
  for(const input of [{...body('get_current_plan'),baseVersion:'stale'},body('transfer_money'),
    body('preview_bill',{billId:'fake',amount:25,change:'by'}),body('preview_monthly_cost',{amount:-20}),
    body('preview_bill',{billId:'internet',amount:25,change:'guess'}),{...body('get_current_plan'),notes:'private'}]) expect(()=>calculateChat(base,input)).toThrow();
});
it('separates a cushion shortfall from the goal outcome assumed by scheduled contributions',()=>{
  const result=calculateChat(base,body('preview_bill',{billId:'internet',amount:25,change:'by'}));
  const brief=chatBrief(result);
  expect(brief).toContain('Projected goal savings if those contributions happen: $2,000.00');
  expect(brief).toContain('Supported monthly savings while preserving the cushion: $290.00');
  expect(brief).toContain('Do not turn a cushion warning into a claim that the goal will be missed');
  expect(brief).toContain('Goal shortfall under the scheduled contributions: $0.00');
  expect(brief).toContain('Never offer to combine previews or change savings contributions');
});
it('retrieves bounded evidence and never forwards private notes or infrastructure identifiers', async()=>{
  const retrieve = vi.fn(async()=>({status:'matched',evidence:Array.from({length:6},()=>({title:'Payroll',text:'Sandbox paycheck',asOf:base.today,documentId:'internal',syncedAt:'internal'}))}));
  const handler=createContextHandler({env,load:async()=>({base,snapshot:{}}),retrieve});
  const out=res();await handler(req(body('get_current_plan',{question:'Income?'})),out);
  expect(out.statusCode).toBe(200);expect(out.body.retrieval.evidence).toHaveLength(4);
  expect(JSON.stringify(out.body)).not.toContain('internal');
  const invalid=res();await handler(req({...body('get_current_plan'),notes:'private'}),invalid);
  expect(invalid.statusCode).toBe(400);expect(retrieve).toHaveBeenCalledTimes(1);
});
it('fails closed for stale or unavailable data, without calling retrieval',async()=>{
  const retrieve=vi.fn(); const out=res();
  await createContextHandler({env,load:async()=>({base,snapshot:{}}),retrieve})(req({...body('get_current_plan'),baseVersion:'old'}),out);
  expect(out.statusCode).toBe(409);expect(retrieve).not.toHaveBeenCalled();
  const failed=res();await createContextHandler({env,load:async()=>{throw new Error('private-db-detail')},retrieve})(req(body('get_current_plan')),failed);
  expect(failed.statusCode).toBe(503);expect(JSON.stringify(failed.body)).not.toContain('private-db-detail');
});
