import { readFile } from 'node:fs/promises';

// Keep the host specified by the implementation plan until its contract is verified.
const BASE = 'https://api.nessieisreal.com';

export async function nessie(path, init = {}) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}key=${process.env.NESSIE_KEY}`;
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Nessie ${res.status}`);
  return res.json();
}

export async function loadSnapshotLike() {
  const cid = process.env.NESSIE_CUSTOMER_ID, ck = process.env.NESSIE_CHECKING_ID;
  try {
    if (!process.env.NESSIE_KEY || !cid || !ck || !process.env.NESSIE_SAVINGS_ID) throw new Error('Sandbox not configured');
    const [accounts, bills, deposits, purchases, merchants] = await Promise.all([
      nessie(`/customers/${cid}/accounts`), nessie(`/accounts/${ck}/bills`), nessie(`/accounts/${ck}/deposits`), nessie(`/accounts/${ck}/purchases`), nessie('/merchants'),
    ]);
    return { source: 'nessie', customerId: cid, checkingId: ck, savingsId: process.env.NESSIE_SAVINGS_ID, accounts, bills, deposits, purchases, merchants };
  } catch {
    // This file is only created by an actual sandbox seed/read-back, never fabricated.
    const snapshot = JSON.parse(await readFile(new URL('../data/nessie-snapshot.json', import.meta.url), 'utf8'));
    return { ...snapshot, source: 'snapshot' };
  }
}
