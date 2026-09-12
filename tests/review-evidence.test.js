import { describe, expect, it, vi } from 'vitest';
import snapshot from '../data/nessie-snapshot.json';
import { retrieveReviewEvidence } from '../api/_review-evidence.js';
const env = { SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_SECRET_KEY: 'secret-test' };
const snap = { ...snapshot, source: 'nessie', asOf: '2026-09-28' };
snap.accountRecords = snap.accounts.map(a => ({ accountId: a._id, bills: a._id === snap.checkingId ? snap.bills : [],
  deposits: a._id === snap.checkingId ? snap.deposits : [], purchases: a._id === snap.checkingId ? snap.purchases : [],
  withdrawals: a._id === snap.checkingId ? snap.withdrawals || [] : [] }));
describe('evidence isolation and freshness', () => {
  it('excludes another snapshot and another data date, even if search matches the words', async () => {
    const rows = [
      { snapshot_id: 'match', as_of: snap.asOf, title: 'Payroll', body: 'An expected deposit.', document_id: 'income' },
      { snapshot_id: 'other', as_of: snap.asOf, title: 'Wrong bank import', body: 'Do not include.' },
      { snapshot_id: 'match', as_of: '2026-08-28', title: 'Wrong date', body: 'Do not include.' },
    ];
    const request = vi.fn(async () => Response.json([{ id: 'match' }]));
    const result = await retrieveReviewEvidence(snap, 'payroll', { env, request, search: async () => rows });
    expect(result.evidence.map(e => e.title)).toEqual(['Payroll']);
    expect(request.mock.calls[0][0]).toMatch(/fingerprint=eq\.[a-f0-9]{64}/);
    expect(request.mock.calls[0][0]).not.toContain('secret-test');
  });
  it('does not use stale evidence or fetch from a user-controlled destination', async () => {
    const search = vi.fn();
    expect(await retrieveReviewEvidence(snap, 'payroll', { env, search, request: async () => Response.json([]) }))
      .toEqual({ status: 'outdated', evidence: [] });
    const request = vi.fn();
    expect(await retrieveReviewEvidence(snap, 'payroll', { env: { ...env, SUPABASE_URL: 'https://evil.example' }, request, search }))
      .toEqual({ status: 'unavailable', evidence: [] });
    expect(search).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
  });
});
