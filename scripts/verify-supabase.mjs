import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { loadLocalEnv, openSetupDatabase } from './supabase-db.mjs';

export async function verifyDatabase(client, { requireData = true } = {}) {
  const tables = ['datasets', 'snapshots', 'accounts', 'merchants', 'bills', 'transactions', 'documents'];
  for (const table of tables) {
    const name = `public.raincheck_${table}`;
    const { rows: [r] } = await client.query(`select c.relrowsecurity as rls,
      has_table_privilege('anon', c.oid, 'SELECT') as anon_read,
      has_table_privilege('authenticated', c.oid, 'SELECT') as user_read,
      has_table_privilege('service_role', c.oid, 'SELECT') as server_read
      from pg_class c where c.oid = $1::regclass`, [name]);
    assert.equal(r.rls, true, `${table}: RLS disabled`);
    assert.equal(r.anon_read, false, `${table}: anonymous access`);
    assert.equal(r.user_read, false, `${table}: unscoped user access`);
    assert.equal(r.server_read, true, `${table}: server cannot read`);
  }
  const { rows: datasets } = await client.query(`select d.dataset_id, s.id, s.as_of::text,
    (select count(*)::int from public.raincheck_accounts a where a.snapshot_id=s.id) as accounts,
    (select count(*)::int from public.raincheck_transactions t where t.snapshot_id=s.id) as transactions,
    (select count(*)::int from public.raincheck_bills b where b.snapshot_id=s.id) as bills,
    (select count(*)::int from public.raincheck_documents doc where doc.snapshot_id=s.id) as documents
    from public.raincheck_datasets d join public.raincheck_snapshots s on s.id=d.current_snapshot_id order by d.dataset_id`);
  if (requireData) assert.deepEqual(datasets.map(d => d.dataset_id), ['backend', 'demo']);
  for (const d of datasets) {
    assert.ok(d.accounts >= 2 && d.transactions > 0 && d.documents > d.transactions);
    const { rows: hits } = await client.query('select * from public.raincheck_search($1, $2, $3)', [d.dataset_id, 'payroll', 5]);
    assert.ok(hits.length > 0 && hits.length <= 5, 'Payroll search should return bounded evidence');
    assert.ok(hits.every(h => h.snapshot_id === d.id), 'Search crossed datasets');
    const { rows: [{ totals }] } = await client.query('select public.raincheck_activity_totals($1,$2,$3,$4) as totals',
      [d.dataset_id, '2025-01-01', d.as_of, null]);
    const { rows: [{ income, count }] } = await client.query(`select
      coalesce(sum(amount_cents) filter(where kind='income'),0)::text as income, count(*)::int as count
      from public.raincheck_transactions where snapshot_id=$1`, [d.id]);
    assert.equal(String(totals.income_cents), income);
    assert.equal(totals.transaction_count, count);
  }
  const { rows: roles } = await client.query(`select p.proname,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as user_exec,
    has_function_privilege('service_role',p.oid,'EXECUTE') as server_exec
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('raincheck_search','raincheck_activity_totals')`);
  assert.equal(roles.length, 2);
  assert.ok(roles.every(r => !r.anon_exec && !r.user_exec && r.server_exec));
  return { tables: tables.length, accessChecks: 'passed', searchAndTotals: datasets.length ? 'passed' : 'not run (no data yet)', datasets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadLocalEnv(); let client;
  try { client = await openSetupDatabase(); console.log(JSON.stringify(await verifyDatabase(client), null, 2)); }
  catch (error) { console.error(`Database verification failed (${error.code || 'ASSERTION'}). No credentials logged.`); process.exitCode = 1; }
  finally { await client?.end(); }
}
