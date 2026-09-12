import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { loadLocalEnv, openSetupDatabase } from './supabase-db.mjs';

loadLocalEnv(); let db;
try {
  db = await openSetupDatabase(); await db.query('begin');
  const { rows: [access] } = await db.query(`select
    (select relrowsecurity from pg_class where oid='public.raincheck_planned_purchases'::regclass) as rls,
    has_table_privilege('anon','public.raincheck_planned_purchases','SELECT') as anon_read,
    has_function_privilege('authenticated','public.raincheck_save_purchase(uuid,integer,jsonb)','EXECUTE') as browser_write,
    has_table_privilege('service_role','public.raincheck_planned_purchases','UPDATE') as direct_write`);
  assert.deepEqual(access, { rls: true, anon_read: false, browser_write: false, direct_write: false });
  await db.query('set local role service_role');
  const id = randomUUID(), second = randomUUID();
  const record = { label: 'Rollback-only integration test', accountId: 'test', amount: 100, date: '2026-10-10', status: 'planned' };
  const save = async (id, revision, record) => (await db.query('select public.raincheck_save_purchase($1,$2,$3) as saved', [id, revision, record])).rows[0].saved;
  const reject = async (id, revision, record) => {
    await db.query('savepoint rejected');
    await assert.rejects(save(id, revision, record));
    await db.query('rollback to savepoint rejected');
  };
  assert.equal((await save(id, 0, record)).revision, 1);
  assert.equal((await save(id, 1, { ...record, amount: 150 })).revision, 2);
  await reject(id, 1, record); await reject(id, 0, record);
  const completed = { ...record, status: 'completed', transactionId: randomUUID(), actualAmount: 100, actualDate: '2026-10-10' };
  assert.equal((await save(id, 2, completed)).status, 'completed');
  await reject(id, 3, record);
  await save(second, 0, record); await reject(second, 1, completed);
  assert.equal((await save(second, 1, { ...record, status: 'cancelled' })).status, 'cancelled');
  console.log('PASS: RLS, restricted writes, create/edit, stale revision, duplicate charge, completed lock and retained removal. All test rows rolled back.');
} catch (e) { console.error(`Purchase database checks failed (${e.code || 'ASSERTION'}); credentials not logged.`); process.exitCode = 1; }
finally { await db?.query('rollback').catch(() => {}); await db?.end(); }
