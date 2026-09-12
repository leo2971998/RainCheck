import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadLocalEnv, openSetupDatabase } from './supabase-db.mjs';
import { verifyDatabase } from './verify-supabase.mjs';

if (!process.argv.includes('--apply')) {
  console.log('Creates the private RainCheck tables and read-only retrieval functions. Run npm run db:setup to apply.');
} else {
  loadLocalEnv(); let client;
  try {
    client = await openSetupDatabase();
    const version = '202609120001';
    const sql = readFileSync(new URL(`../supabase/migrations/${version}_raincheck_knowledge.sql`, import.meta.url), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('raincheck-schema'))");
    await client.query(`create schema if not exists raincheck_private;
      revoke all on schema raincheck_private from public,anon,authenticated,service_role;
      create table if not exists raincheck_private.migrations(version text primary key, checksum text not null, applied_at timestamptz not null default now())`);
    const { rows: [previous] } = await client.query('select checksum from raincheck_private.migrations where version=$1', [version]);
    if (previous && previous.checksum !== hash) throw new Error('Applied migration checksum changed. Add a new migration instead.');
    if (!previous) {
      await client.query(sql);
      await client.query('insert into raincheck_private.migrations(version,checksum) values($1,$2)', [version, hash]);
    }
    const verification = await verifyDatabase(client, { requireData: false });
    await client.query('commit');
    console.log(JSON.stringify({ migration: previous ? 'already applied' : 'applied', ...verification }, null, 2));
  } catch (error) {
    await client?.query('rollback').catch(() => {});
    console.error(`Database setup failed (${error.code || 'VALIDATION'}). Changes rolled back; credentials not logged.`);
    process.exitCode = 1;
  } finally { await client?.end(); }
}
