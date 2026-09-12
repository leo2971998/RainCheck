import { pathToFileURL } from 'node:url';
import { loadLocalEnv, openSetupDatabase } from './supabase-db.mjs';
import { prepareKnowledge } from './supabase-knowledge.mjs';
import { readDataset } from '../api/_dataset.js';
import { verifyDatabase } from './verify-supabase.mjs';

// Names and types are code-owned constants, never model/user-supplied SQL.
const collections = {
  accounts: 'id text,name text,kind text,balance_cents bigint',
  merchants: 'id text,name text,category text',
  bills: 'id text,account_id text,name text,payee text,amount_cents bigint,details jsonb',
  transactions: 'id text,account_id text,source_id text,source_type text,merchant_id text,bill_id text,booked_on date,amount_cents bigint,description text,kind text,category text,details jsonb',
  documents: 'id text,source_type text,source_id text,title text,body text,account_id text,record_date date',
};

export async function syncKnowledge(client, payload) {
  await client.query('begin');
  try {
    await client.query('insert into public.raincheck_datasets(dataset_id,customer_id) values($1,$2) on conflict do nothing',
      [payload.dataset, payload.customer_id]);
    const { rows: [dataset] } = await client.query('select * from public.raincheck_datasets where dataset_id=$1 for update', [payload.dataset]);
    if (!dataset || dataset.customer_id !== payload.customer_id) throw new Error('Dataset customer changed; import stopped.');
    const { rows: [existing] } = await client.query('select id from public.raincheck_snapshots where dataset_id=$1 and fingerprint=$2',
      [payload.dataset, payload.fingerprint]);
    let id = existing?.id;
    if (!id) {
      const { rows: [snapshot] } = await client.query(`insert into public.raincheck_snapshots
        (dataset_id,fingerprint,as_of,captured_at,source,household,source_snapshot) values($1,$2,$3,$4,$5,$6,$7) returning id`,
      [payload.dataset, payload.fingerprint, payload.as_of, payload.captured_at, payload.source,
        JSON.stringify(payload.household), JSON.stringify(payload.source_snapshot)]);
      id = snapshot.id;
      for (const [table, definitions] of Object.entries(collections)) {
        const columns = definitions.split(',').map(c => c.split(' ')[0]).join(',');
        await client.query(`insert into public.raincheck_${table}(snapshot_id,${columns})
          select $1::uuid,${columns} from jsonb_to_recordset($2::jsonb) as x(${definitions})`, [id, JSON.stringify(payload[table])]);
      }
    }
    await client.query('update public.raincheck_datasets set current_snapshot_id=$2 where dataset_id=$1', [payload.dataset, id]);
    await client.query('commit');
    return { dataset: payload.dataset, snapshot: id, status: existing ? 'reused snapshot' : 'imported',
      asOf: payload.as_of, transactions: payload.transactions.length, documents: payload.documents.length };
  } catch (error) { await client.query('rollback'); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv.includes('--apply')) console.log('Copies the two configured Nessie demo households to Supabase. Run npm run db:sync to apply.');
  else {
    loadLocalEnv(); let client;
    try {
      // Read every account successfully before changing the database. No snapshot fallback.
      const payloads = [];
      for (const dataset of ['demo', 'backend']) {
        const snapshot = await readDataset(dataset);
        payloads.push(prepareKnowledge(snapshot, { dataset, asOf: snapshot.asOf }));
      }
      client = await openSetupDatabase();
      for (const payload of payloads) console.log(JSON.stringify(await syncKnowledge(client, payload)));
      console.log(JSON.stringify(await verifyDatabase(client), null, 2));
    } catch (error) {
      console.error(`Database sync failed (${error.code || 'VALIDATION_OR_SOURCE'}). Incomplete imports were not published; credentials not logged.`);
      process.exitCode = 1;
    } finally { await client?.end(); }
  }
}
