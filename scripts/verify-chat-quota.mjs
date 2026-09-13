import assert from 'node:assert/strict';
import { loadLocalEnv, openSetupDatabase } from './supabase-db.mjs';

// Transactional checks: every test quota is rolled back, never charged to the demo.
loadLocalEnv(); let client;
try {
  client = await openSetupDatabase();
  await client.query('begin');
  await client.query("select pg_advisory_xact_lock(hashtext('raincheck-chat-session'))");
  await client.query("select pg_advisory_xact_lock(hashtext('raincheck-chat-context'))");
  const { rows: [roles] } = await client.query(`select
    has_function_privilege('anon','public.raincheck_chat_quota(text,text)','execute') as anon,
    has_function_privilege('authenticated','public.raincheck_chat_quota(text,text)','execute') as authenticated,
    has_function_privilege('service_role','public.raincheck_chat_quota(text,text)','execute') as server`);
  assert.deepEqual(roles, { anon: false, authenticated: false, server: true });
  // Clear counts inside this rolled-back transaction only so tests work after real use.
  await client.query('delete from raincheck_private.chat_quota');
  const call = async (subject, kind='session') => (await client.query('select public.raincheck_chat_quota($1,$2) as result',[subject,kind])).rows[0].result;
  for (let i=0;i<3;i++) assert.equal((await call('a'.repeat(64))).allowed,true);
  const blocked=await call('a'.repeat(64)); assert.equal(blocked.allowed,false); assert.ok(blocked.retryAfter>0);
  const { rows:[counts] } = await client.query("select sum(used)::int as total from raincheck_private.chat_quota where bucket='session:global'");
  assert.equal(counts.total,3,'Rejected attempts must not consume global capacity');
  for (let i=3;i<100;i++) assert.equal((await call(i.toString(16).padStart(64,'0'))).allowed,true);
  assert.equal((await call('f'.repeat(64))).allowed,false,'The shared daily cap must apply across clients');
  for(let i=0;i<30;i++) assert.equal((await call('b'.repeat(64),'context')).allowed,true);
  assert.equal((await call('b'.repeat(64),'context')).allowed,false);
  console.log('Chat quota verified: private access, per-client limits, shared daily cap, and no charge for rejected requests.');
} catch (e) {
  console.error(`Chat quota verification failed (${e.code || e.name}). No credentials logged.`); process.exitCode=1;
} finally { await client?.query('rollback').catch(()=>{}); await client?.end(); }
