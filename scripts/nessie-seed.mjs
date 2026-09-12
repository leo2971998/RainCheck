import { isDeepStrictEqual } from 'node:util';
const address = { street_number: '100', street_name: 'Test Street', city: 'Houston', state: 'TX', zip: '77005' };

/** Additive seed. Never deletes, updates, or retries a POST blindly. Run one instance at a time. */
export async function seedFixture(fixture, request, progress = () => {}) {
  const list = async path => {
    const rows = await request('GET', path);
    if (!Array.isArray(rows)) throw new Error('Unexpected collection response');
    return rows;
  };
  const ensure = async (path, known, match, body) => {
    const matches = known.filter(match);
    if (matches.length > 1) throw new Error(`Duplicate test records at ${path}; inspect before resuming.`);
    if (matches.length) {
      const record = matches[0];
      if (Object.entries(body).some(([key, value]) => !isDeepStrictEqual(record[key], value)))
        throw new Error(`Existing test record differs at ${path}; nothing was overwritten.`);
      return record;
    }
    const result = await request('POST', path, body);
    const record = result.objectCreated;
    if (!record?._id) throw new Error('Creation not confirmed. Read back before retrying.');
    // Use the submitted body too: some Nessie POST responses return only the new ID.
    const complete = { ...body, ...record };
    known.push(complete);
    return complete;
  };
  const customer = await ensure('/customers', await list('/customers'),
    c => c.first_name === fixture.customer.first_name && c.last_name === fixture.customer.last_name,
    { ...fixture.customer, address });
  const accountPath = `/customers/${customer._id}/accounts`, knownAccounts = await list(accountPath), accountIds = {};
  for (const a of fixture.accounts) accountIds[a.key] = (await ensure(accountPath, knownAccounts, x => x.nickname === a.nickname,
    { type: a.type, nickname: a.nickname, rewards: 0, balance: a.balance }))._id;
  progress('Customer and three connected accounts ready.');
  const merchants = await list('/merchants'), merchantIds = {};
  for (const m of fixture.merchants) merchantIds[m.key] = (await ensure('/merchants', merchants, x => x.name === m.name,
    { name: m.name, category: m.category, address, geocode: { lat: 29.7604, lng: -95.3698 } }))._id;
  const billPath = `/accounts/${accountIds.checking}/bills`, bills = await list(billPath), billIds = {};
  for (const b of fixture.bills) {
    const nickname = `${fixture.namespace} ${b.label}`;
    billIds[b.key] = (await ensure(billPath, bills, x => x.nickname === nickname, {
      status: 'recurring', payee: fixture.merchants.find(m => m.key === b.merchant).name, nickname,
      recurring_date: b.day, payment_date: `2026-10-${String(b.day).padStart(2, '0')}`, payment_amount: b.amount,
    }))._id;
  }
  const collections = { deposit: 'deposits', purchase: 'purchases', withdrawal: 'withdrawals' };
  const saved = [], cache = new Map();
  for (const r of fixture.records) {
    const path = `/accounts/${accountIds[r.account]}/${collections[r.type]}`;
    if (!cache.has(path)) cache.set(path, await list(path));
    const dateField = r.type === 'purchase' ? 'purchase_date' : 'transaction_date';
    const body = { medium: 'balance', [dateField]: r.date, status: 'completed', amount: r.amount, description: r.description,
      ...(r.merchant ? { merchant_id: merchantIds[r.merchant] } : {}) };
    const record = await ensure(path, cache.get(path), x => x[dateField] === r.date && x.description === r.description
      && (!r.merchant || x.merchant_id === merchantIds[r.merchant]), body);
    saved.push({ ...r, sourceId: record._id, accountId: accountIds[r.account],
      merchantId: merchantIds[r.merchant] || null, billId: billIds[r.bill] || null });
    if (saved.length % 50 === 0) progress(`${saved.length}/${fixture.records.length} activity records ready.`);
  }
  for (const r of saved) {
    if (r.transfer) r.counterpartId = saved.find(x => x.transfer === r.transfer && x.key !== r.key)?.sourceId;
    if (r.refundOf) r.refundOfId = saved.find(x => x.key === r.refundOf)?.sourceId;
  }
  return { version: fixture.version, synthetic: true, asOf: fixture.asOf, customerId: customer._id,
    checkingId: accountIds.checking, savingsId: accountIds.emergency, accountIds, merchantIds, billIds,
    openingBalances: Object.fromEntries(fixture.accounts.map(a => [accountIds[a.key], a.openingBalance])), records: saved };
}
