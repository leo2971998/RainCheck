import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLocalEnv, openSetupDatabase } from './supabase-db.mjs';
import { prepareKnowledge } from './supabase-knowledge.mjs';
import { syncKnowledge } from './sync-supabase.mjs';

// Explicit integration check against the disposable backend test household only.
loadLocalEnv(); let client;
try {
  client = await openSetupDatabase();
  const state = async () => (await client.query(`select current_snapshot_id,
    (select count(*)::int from public.raincheck_snapshots where dataset_id='backend') as snapshots
    from public.raincheck_datasets where dataset_id='backend'`)).rows[0];
  const before = await state();
  assert.ok(before?.current_snapshot_id, 'Sync the backend household first');
  const snapshot = readFileSync(new URL('../output/nessie-backend-v1/snapshot.json', import.meta.url), 'utf8');
  const payload = prepareKnowledge(JSON.parse(snapshot), { dataset: 'backend', asOf: process.env.NESSIE_TEST_AS_OF });
  const existing = await client.query('select id from public.raincheck_snapshots where dataset_id=$1 and fingerprint=$2', ['backend', payload.fingerprint]);
  assert.equal(existing.rows[0]?.id, before.current_snapshot_id, 'Fixture and current database differ; refresh the fixture before this test');
  const repeated = await syncKnowledge(client, payload);
  assert.equal(repeated.status, 'reused snapshot');
  assert.deepEqual(await state(), before, 'Repeated sync duplicated data');
  const broken = structuredClone(payload);
  broken.fingerprint = '0'.repeat(64);
  broken.transactions[0].account_id = 'not-an-owned-account';
  await assert.rejects(syncKnowledge(client, broken), e => e.code === '23503');
  assert.deepEqual(await state(), before, 'Failed import changed the current dataset');
  await client.query('begin');
  await client.query('set local role anon');
  await assert.rejects(client.query('select * from public.raincheck_transactions limit 1'), e => e.code === '42501');
  await client.query('rollback');
  await client.query('begin');
  await client.query('set local role authenticated');
  await assert.rejects(client.query('select * from public.raincheck_search($1,$2,$3)', ['backend', 'payroll', 5]), e => e.code === '42501');
  await client.query('rollback');
  await assert.rejects(client.query('select public.raincheck_activity_totals($1,$2,$3,$4)',
    ['demo', '2025-10-01', '2026-09-28', process.env.NESSIE_TEST_CHECKING_ID]), e => e.code === '22023');
  const injection = await client.query('select * from public.raincheck_search($1,$2,$3)',
    ['backend', "'; drop table public.raincheck_transactions; --", 5]);
  assert.ok(injection.rows.length <= 5);
  assert.deepEqual(await state(), before);
  console.log(JSON.stringify({ repeatSync: 'passed', failedSyncRollback: 'passed', anonymousReadBlocked: true,
    unscopedUserReadBlocked: true, foreignAccountBlocked: true, injectionIsData: true }));
} catch (error) {
  await client?.query('rollback').catch(() => {});
  console.error(`Sync integration checks failed (${error.code || 'ASSERTION'}). No credentials logged.`);
  process.exitCode = 1;
} finally { await client?.end(); }
