import { readFile } from 'node:fs/promises';

// Keep the host specified by the implementation plan until its contract is verified.
const BASE = 'https://api.nessieisreal.com';

export async function nessie(path, init = {}) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}key=${process.env.NESSIE_KEY}`;
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw Object.assign(new Error(`Nessie ${res.status}`), { status: res.status });
  return res.json();
}

/** Strict read: never substitute another household after an upstream failure. */
export async function loadNessieSnapshot({ customerId, checkingId, savingsId }, request = nessie) {
  const accounts = await request(`/customers/${customerId}/accounts`);
  if (!Array.isArray(accounts) || ![checkingId, savingsId].every(id => accounts.some(a => a._id === id)))
    throw new Error('Configured accounts do not belong to this household.');
  const list = async path => {
    try {
      const rows = await request(path);
      if (!Array.isArray(rows)) throw new Error('Invalid Nessie collection.');
      return rows;
    } catch (err) { if (err.status === 404) return []; throw err; }
  };
  const accountRecords = await Promise.all(accounts.map(async a => {
    const result = { accountId: a._id };
    await Promise.all(['bills', 'deposits', 'purchases', 'withdrawals'].map(async kind => {
      result[kind] = (await list(`/accounts/${a._id}/${kind}`)).map(r => ({ ...r, account_id: a._id }));
    }));
    return result;
  }));
  const merchantIds = new Set(accountRecords.flatMap(a => a.purchases.map(p => p.merchant_id)));
  const merchants = (await list('/merchants')).filter(m => merchantIds.has(m._id));
  const checking = accountRecords.find(a => a.accountId === checkingId);
  return { source: 'nessie', capturedAt: new Date().toISOString(), customerId, checkingId, savingsId,
    accounts, accountRecords, merchants, bills: checking.bills, deposits: checking.deposits,
    purchases: checking.purchases, withdrawals: checking.withdrawals };
}

export async function loadSnapshotLike() {
  const cid = process.env.NESSIE_CUSTOMER_ID, ck = process.env.NESSIE_CHECKING_ID;
  try {
    if (!process.env.NESSIE_KEY || !cid || !ck || !process.env.NESSIE_SAVINGS_ID) throw new Error('Sandbox not configured');
    return await loadNessieSnapshot({ customerId: cid, checkingId: ck, savingsId: process.env.NESSIE_SAVINGS_ID });
  } catch {
    // This file is only created by an actual sandbox seed/read-back, never fabricated.
    const snapshot = JSON.parse(await readFile(new URL('../data/nessie-snapshot.json', import.meta.url), 'utf8'));
    return { ...snapshot, source: 'snapshot' };
  }
}
