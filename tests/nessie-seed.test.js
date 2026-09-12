import { expect, it } from 'vitest';
import { seedFixture } from '../scripts/nessie-seed.mjs';
import { buildFixture } from '../scripts/nessie-fixture.mjs';

function fakeBank() {
  const collections = new Map([['/customers', [{ _id: 'existing', first_name: 'Alex', last_name: 'Rivera' }]]]);
  let writes = 0;
  const request = async (method, path, body) => {
    if (!collections.has(path)) collections.set(path, []);
    const list = collections.get(path);
    if (method === 'GET') return structuredClone(list);
    if (method !== 'POST') throw new Error('Destructive operation not allowed');
    writes++;
    const objectCreated = { ...structuredClone(body), _id: `record-${writes}` };
    list.push(objectCreated);
    return { objectCreated };
  };
  return { request, collections, writes: () => writes };
}

it('resumes without duplicate writes and preserves preexisting customers', async () => {
  const bank = fakeBank(), fixture = buildFixture();
  const first = await seedFixture(fixture, bank.request);
  const writes = bank.writes();
  const again = await seedFixture(fixture, bank.request);
  expect(bank.writes()).toBe(writes);
  expect(again).toEqual(first);
  expect(first.records).toHaveLength(fixture.records.length);
  expect(bank.collections.get('/customers')[0]).toEqual({ _id: 'existing', first_name: 'Alex', last_name: 'Rivera' });
  for (const r of first.records) expect(r.sourceId).toBeTruthy();
  expect(first.records.filter(r => r.transfer).every(r => r.counterpartId)).toBe(true);
});

it('stops instead of overwriting a changed test record', async () => {
  const bank = fakeBank(), fixture = buildFixture();
  const result = await seedFixture(fixture, bank.request);
  bank.collections.get(`/accounts/${result.checkingId}/deposits`)[0].amount += 1;
  await expect(seedFixture(fixture, bank.request)).rejects.toThrow(/differs/i);
});

it('can resume after a request succeeded but its response was lost', async () => {
  const bank = fakeBank(), fixture = buildFixture();
  let interrupted = false;
  const request = async (method, path, body) => {
    const result = await bank.request(method, path, body);
    if (!interrupted && method === 'POST' && path.endsWith('/purchases')) { interrupted = true; throw new Error('Lost response'); }
    return result;
  };
  await expect(seedFixture(fixture, request)).rejects.toThrow('Lost response');
  const result = await seedFixture(fixture, bank.request);
  expect(result.records).toHaveLength(fixture.records.length);
  expect([...bank.collections.values()].flat().filter(r => r.purchase_date)).toHaveLength(fixture.records.filter(r => r.type === 'purchase').length);
});
