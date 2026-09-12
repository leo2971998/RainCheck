// Checks what your Nessie key can see. Never prints the key.
// Run: node scripts/check-nessie.mjs
import { readFile } from 'node:fs/promises';

const BASE = 'https://api.nessieisreal.com';

async function loadKey() {
  if (process.env.NESSIE_KEY) return process.env.NESSIE_KEY.trim();
  for (const p of ['.env.local', '.env', 'app/.env.local']) {
    try {
      const line = (await readFile(new URL('../' + p, import.meta.url), 'utf8')).split('\n').find(l => l.startsWith('NESSIE_KEY='));
      if (line) return line.slice('NESSIE_KEY='.length).trim().replace(/^["']|["']$/g, '');
    } catch {}
  }
  return null;
}

const KEY = await loadKey();
if (!KEY) {
  console.error('No key found. Put NESSIE_KEY=... in D:\\Projects\\raincheck\\.env.local');
  process.exit(1);
}
console.log(`Key loaded: ${KEY.length} characters, ends "...${KEY.slice(-4)}"\n`);

async function get(path) {
  const t = Date.now();
  try {
    const res = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}key=${KEY}`, { signal: AbortSignal.timeout(15000) });
    const ms = Date.now() - t;
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
    return { ok: res.ok, status: res.status, ms, body };
  } catch (e) { return { ok: false, status: 0, ms: Date.now() - t, body: e.message }; }
}

const n = v => Array.isArray(v) ? v.length : null;
const rows = [];

// 1. Is the service up at all? /atms is public reference data.
const atms = await get('/atms?lat=29.7174&lng=-95.4018&rad=5');
rows.push(['Service reachable (/atms)', atms.ok ? `yes, ${atms.ms} ms` : `NO (${atms.status || atms.body})`]);

// 2. What does THIS key own?
const customers = await get('/customers');
const accounts  = await get('/accounts');
const merchants = await get('/merchants');
rows.push(['HTTP status for /customers', String(customers.status)]);
rows.push(['Customers under your key', n(customers.body) ?? `unexpected: ${JSON.stringify(customers.body).slice(0, 80)}`]);
rows.push(['Accounts under your key', n(accounts.body) ?? '—']);
rows.push(['Merchants under your key', n(merchants.body) ?? '—']);

console.log(rows.map(([k, v]) => `  ${k.padEnd(32)} ${v}`).join('\n'));

// 3. Interpret
const cust = Array.isArray(customers.body) ? customers.body : [];
const accts = Array.isArray(accounts.body) ? accounts.body : [];

if (!atms.ok) {
  console.log('\nThe sandbox itself is not answering. Try again shortly; this is not your key.');
} else if (customers.status !== 200) {
  console.log(`\nYour key was rejected (HTTP ${customers.status}). Re-copy it from nessieisreal.com; no spaces or quotes.`);
} else if (cust.length === 0) {
  console.log('\nThe key WORKS but owns no data yet. An unknown key also returns [], so the proof it is valid');
  console.log('is that a write succeeds. Next step: run scripts/seed-nessie.mjs to create Alex Rivera,');
  console.log('a checking and savings account, seven bills, paychecks and three months of purchases.');
} else {
  console.log(`\nYour key owns ${cust.length} customer(s):`);
  for (const c of cust.slice(0, 5)) {
    const mine = accts.filter(a => a.customer_id === c._id);
    console.log(`  • ${c.first_name} ${c.last_name} — ${mine.length} account(s)`);
    for (const a of mine) console.log(`      ${a.type.padEnd(12)} ${a.nickname || '(no nickname)'}  balance $${a.balance}`);
  }
  // Detail for the checking account: is there enough to build a household?
  const a = accts.find(x => x.type === 'Checking') || accts[0];
  if (a) {
    const [bills, deposits, purchases] = await Promise.all([get(`/accounts/${a._id}/bills`), get(`/accounts/${a._id}/deposits`), get(`/accounts/${a._id}/purchases`)]);
    console.log(`\n  Checking account "${a.nickname || a._id}":`);
    console.log(`      bills      ${n(bills.body) ?? '—'}`);
    console.log(`      deposits   ${n(deposits.body) ?? '—'}`);
    console.log(`      purchases  ${n(purchases.body) ?? '—'}`);
    const enough = (n(bills.body) || 0) >= 3 && (n(deposits.body) || 0) >= 3 && (n(purchases.body) || 0) >= 10;
    console.log(enough ? '\n  Enough records to build the household. Skip the seed script.' : '\n  Not enough yet. Run scripts/seed-nessie.mjs to fill it in.');
  }
}
