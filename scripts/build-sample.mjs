// Regenerates data/household.sample.js from data/nessie-snapshot.json.
//
// Sample mode and live mode go through the SAME builder, so their ids, categories and field
// shapes cannot drift apart. Drift is how a bug hides in whichever mode you are not testing.
//
//   node scripts/build-sample.mjs
import { writeFileSync } from 'node:fs';

delete process.env.NESSIE_KEY;                       // force the snapshot path
process.env.VITE_DEMO_DATE ||= '2026-09-28';

const { default: handler } = await import('../api/household.js');

let out;
await handler({ method: 'GET' }, {
  setHeader() {}, status(code) { this.code = code; return this; },
  json(body) { out = { code: this.code, body }; return this; },
});
if (out.code !== 200) throw new Error(`The household route returned ${out.code}: ${JSON.stringify(out.body)}`);

const { household, transactions, notice } = out.body;
writeFileSync(new URL('../data/household.sample.js', import.meta.url),
`// GENERATED from data/nessie-snapshot.json — do not edit by hand.
// Regenerate with:  node scripts/build-sample.mjs
//
// Sample mode and live mode go through the same builder, so ids, categories and shapes match.
export const household = ${JSON.stringify(household, null, 2)};

export const transactions = ${JSON.stringify(transactions, null, 2)};

export const notice = ${JSON.stringify(notice)};
`);

console.log(`Wrote data/household.sample.js — ${household.recurring.length} commitments, ${household.allowances.length} categories, ${transactions.length} transactions.`);
