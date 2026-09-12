import { nessie } from './_nessie.js';

/**
 * Move a contribution from checking to savings in the Nessie sandbox.
 *
 * Two things worth knowing, both verified against the live sandbox:
 *
 *  1. A Nessie transfer cannot name a destination. POST /accounts/{id}/transfers accepts only
 *     transaction_date, status, amount and description, and rejects payee_id outright. So a
 *     contribution is a withdrawal from checking paired with a deposit into savings.
 *
 *  2. Posting money does not change an account's `balance` field. The sandbox keeps the balance
 *     you created the account with. So we report the status Nessie gives back for the deposit,
 *     and we do NOT claim the savings balance moved. The UI shows the plan's figure and says
 *     where it came from.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ message: 'Use POST to request a transfer.' });

  const checking = process.env.NESSIE_CHECKING_ID, savings = process.env.NESSIE_SAVINGS_ID;
  if (!process.env.NESSIE_KEY || !checking || !savings)
    return res.status(503).json({ message: 'The sandbox is not configured, so no transfer was attempted.' });

  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000)
    return res.status(400).json({ message: 'Enter an amount between $1 and $5,000.' });

  const date = process.env.VITE_DEMO_DATE || new Date().toISOString().slice(0, 10);

  // One contribution per amount per day. A double-tap or a retry after a slow response must not
  // move the money twice; the caller gets the record that already exists.
  const existing = await nessie(`/accounts/${savings}/deposits`).catch(() => []);
  const already = Array.isArray(existing) && existing.find(d =>
    d.transaction_date === date && Math.round(d.amount) === Math.round(amount) && /RainCheck/.test(d.description || ''));
  if (already) return res.status(200).json({
    status: already.status ?? 'completed', amount: Math.round(amount), date, depositId: already._id,
    duplicate: true, message: 'A contribution for this amount was already recorded today.',
  });
  const body = (description) => ({ medium: 'balance', transaction_date: date, status: 'completed', amount: Math.round(amount), description });

  try {
    // Leave checking first. If the deposit fails we would rather owe the user an explanation
    // about a missing credit than invent one that never happened.
    const out = await nessie(`/accounts/${checking}/withdrawals`, { method: 'POST', body: JSON.stringify(body('Transfer to savings · RainCheck')) });
    const withdrawalId = out?.objectCreated?._id ?? null;

    let inn;
    try {
      inn = await nessie(`/accounts/${savings}/deposits`, { method: 'POST', body: JSON.stringify(body('Transfer from checking · RainCheck')) });
    } catch (depositError) {
      // The money left checking but never arrived. Say exactly that, rather than reporting a
      // failure that hides a completed withdrawal the user needs to know about.
      return res.status(502).json({
        message: 'The money left checking but the deposit into savings was not recorded. Check both accounts before trying again.',
        withdrawalId, halfCompleted: true, detail: String(depositError?.message || depositError),
      });
    }

    const depositId = inn?.objectCreated?._id;
    if (!depositId) return res.status(502).json({ message: 'The sandbox accepted the request but returned no record to confirm.', withdrawalId, halfCompleted: true });

    // Read it back. Nothing is reported as done on the strength of our own request.
    const confirmed = await nessie(`/deposits/${depositId}`);
    const account = await nessie(`/accounts/${savings}`);

    return res.status(200).json({
      status: confirmed?.status ?? 'unknown',
      amount: Math.round(amount),
      date,
      withdrawalId,
      depositId,
      savingsBalance: account?.balance ?? null,
      // Say plainly that the sandbox does not re-total balances, so nobody reads the
      // unchanged number as a failed transfer.
      balanceNote: 'The sandbox records transactions but does not re-total account balances.',
    });
  } catch (err) {
    return res.status(502).json({ message: 'The transfer could not be confirmed.', detail: String(err?.message || err) });
  }
}
