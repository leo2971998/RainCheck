// Defaults to a dry run. --apply adds ONLY the separate RC Backend V1 household.
// Generated reports stay in ignored output/, never in the published sample or secret config.
import { readFile, writeFile, mkdir, open, unlink } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { buildFixture } from './nessie-fixture.mjs';
import { seedFixture } from './nessie-seed.mjs';
import { loadNessieSnapshot } from '../api/_nessie.js';
import { buildHousehold } from '../src/engine/household.js';
import { transactionRecords } from '../src/engine/records.js';

const fixture = buildFixture();
console.log(JSON.stringify({ synthetic: true, asOf: fixture.asOf, months: 12, accounts: fixture.accounts.length,
  merchants: fixture.merchants.length, bills: fixture.bills.length, activity: fixture.records.length,
  action: process.argv.includes('--apply') ? 'Add/resume isolated test household' : 'Dry run; no network or writes' }));
if (!process.argv.includes('--apply')) process.exit(0);

const root = new URL('../', import.meta.url), output = new URL('output/nessie-backend-v1/', root);
const env = parseEnv(await readFile(new URL('.env.local', root), 'utf8'));
const key = process.env.NESSIE_KEY || env.NESSIE_KEY;
if (!key) throw new Error('Set NESSIE_KEY locally before seeding.');
await mkdir(output, { recursive: true });
const lockPath = new URL('seed.lock', output);
let lock;
try { lock = await open(lockPath, 'wx'); }
catch { console.error('Another seed may be running. Inspect output/nessie-backend-v1/seed.lock before retrying.'); process.exit(1); }

let writeRequests = 0;
async function request(method, path, body) {
  if (method === 'POST') writeRequests++;
  const response = await fetch(`https://api.nessieisreal.com${path}?key=${encodeURIComponent(key)}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  if (response.status === 404 && method === 'GET' && /\/(bills|deposits|purchases|withdrawals)$/.test(path)) return [];
  if (!response.ok) throw new Error(`Nessie ${method} returned HTTP ${response.status}. No automatic write retry.`);
  return response.json();
}

try {
  const manifest = await seedFixture(fixture, request, message => console.log(message));
  const snap = await loadNessieSnapshot(manifest, path => request('GET', path));
  const normalized = snap.accounts.flatMap(a => transactionRecords(snap, fixture.asOf, a._id));
  if (normalized.length !== fixture.records.length) throw new Error('Read-back record count differs from the fixture.');
  for (const expected of manifest.records) {
    const actual = normalized.find(r => r.sourceId === expected.sourceId && r.sourceType === expected.type);
    if (!actual || actual.accountId !== expected.accountId || actual.date !== expected.date || Math.abs(actual.amount) !== expected.amount
      || actual.merchantId !== expected.merchantId || actual.billId !== expected.billId)
      throw new Error(`Read-back mismatch for test record ${expected.key}.`);
  }
  const balances = snap.accounts.map(a => {
    const net = normalized.filter(r => r.accountId === a._id).reduce((sum, r) => sum + r.amount, 0);
    const expected = manifest.openingBalances[a._id] + net;
    if (expected !== a.balance) throw new Error('Account balance does not reconcile to opening funds plus history.');
    return { accountId: a._id, openingBalance: manifest.openingBalances[a._id], net, balance: a.balance, reconciled: true };
  });
  const household = buildHousehold(snap, fixture.asOf);
  const report = { verifiedAt: new Date().toISOString(), synthetic: true, asOf: fixture.asOf,
    activityCount: normalized.length, balances, nextIncome: household.income,
    note: 'Nessie balances are seed-time snapshots, not an automatically maintained ledger. Future writes must reconcile them.' };
  for (const [name, value] of [['manifest.json', manifest], ['snapshot.json', snap], ['verification.json', report]])
    await writeFile(new URL(name, output), JSON.stringify(value, null, 2) + '\n');
  console.log(JSON.stringify({ verified: true, writeRequests, activity: normalized.length, accountsReconciled: balances.length,
    nextIncome: household.income.map(p => ({ date: p.date, amount: p.amount })),
    reportFolder: 'output/nessie-backend-v1', publishedDemoUnchanged: true }));
} catch (err) {
  console.error('Seed stopped before verification completed. Records already created are preserved; rerun to resume. No secret details displayed.');
  if (/^(Nessie |Existing test|Duplicate test|Read-back|Account balance|Creation not)/.test(err.message)) console.error(err.message);
  process.exitCode = 1;
} finally {
  await lock.close();
  await unlink(lockPath);
}
