# RainCheck

RainCheck is a savings goal that knows what your bills are doing. State a goal the way a person
states one — **this much, by this date** — and RainCheck tells you whether your plan can carry it,
what changes when a bill goes up, and what the two honest ways forward actually cost.

Built for HackRice 16 · Finance track · Capital One Nessie challenge.

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:5176
```

It starts on sample data with no setup. `npm run dev` also serves the `api/` folder the way Vercel does, so the live path can be tested locally.

```bash
npm test             # engine, API, and dataset regression tests
npm run build
```

## Connect the Capital One sandbox

1. Sign in at https://nessieisreal.com with GitHub and copy your key.
2. Seed a household and capture a snapshot: `node scripts/seed-nessie.mjs`. It prints the three account IDs it creates, and verifies that the seeded data reproduces the numbers the demo depends on. `node scripts/check-nessie.mjs` reports what a key can see without printing it.
3. Copy `.env.example` to `.env.local` and fill it in, then set `VITE_DATA_MODE=nessie`.

The base URL is `https://api.nessieisreal.com`. The `http://` address in Nessie's own docs times out.

Without a key the app reads `data/nessie-snapshot.json`, a real read-back from the sandbox, so it still works with no network.

## Larger backend test dataset

The separate **RC Backend V1** household contains 12 months of synthetic activity: 426 transactions,
three accounts (checking, emergency savings, travel savings), 18 merchants, and seven recurring bills.
It includes a payroll raise, bill postings, refunds, cash withdrawals, and 24 paired savings transfers.
It does not replace the published Alex Rivera demo, UI, or bundled sample files.

```bash
npm run data:preview  # deterministic summary; no writes or network
npm run data:seed     # create/resume ONLY the separate test household, then read back and reconcile
```

The seeder loads `NESSIE_KEY` from `.env.local`. It never deletes or overwrites existing records,
and stops on conflicts. Run only one seed process at a time. A lost response can be recovered by
rerunning: matching records are read before any new POST. Do not use the older `seed-nessie.mjs`
to expand existing data: that legacy script can rebuild the original checking account.

Generated `output/nessie-backend-v1/` contains native-ID mappings (`manifest.json`), a read-back
export (`snapshot.json`), and a balance/income check (`verification.json`). These ignored files contain
test data, not API keys. The persistent records live in Nessie, not in the export files.

Set the optional `NESSIE_TEST_*` values in `.env.local` from the manifest and restart the dev server.
The default website still uses its original `NESSIE_*` account IDs.

Backend reads:

- `GET /api/household?dataset=backend`: forecast inputs from the larger dataset; income includes source transaction IDs.
- `GET /api/transactions?dataset=backend&limit=50&offset=0`: checking history, ISO dates, native IDs, merchant and bill links.
- Add `accountId` from the response's account list to read a savings account.
- Optional filters: `kind=income`, `from=2026-09-01`, `to=2026-09-28`. Filtering happens before pagination; totals cover the entire filtered result.
- `dataset=demo` (default) selects the original demo. Other dataset names/accounts are rejected. The transaction route never substitutes sample records when live reads fail.

Income comparisons must use the same period: the original $1,700 biweekly payroll produces
$3,400 in September 2026 but $5,100 in October (three paydays). The larger test household's latest
$1,800 payroll produces a $1,800-per-payday estimate, linked to the deposits that supplied it.
Estimates are not confirmed future deposits. Recognition currently uses payroll-description rules
and the dominant observed income series; irregular/multiple-source income needs further work.

Future CRUD must preserve customer/account ownership, native IDs, and paired-transfer relationships.
The manifest explicitly links refunds to purchases and both transfer legs; API transfer matching is
an inference from descriptions, amounts and dates, and reports ambiguous pairs instead of guessing.
Nessie's stored balances do not automatically re-total after transaction writes: seed-time balances
are reconciled to opening funds plus posted history. A later CRUD service will need ledger reconciliation,
per-user authorization, and durable idempotency. No new public write endpoints are enabled here.

API shape reference: [Nessie's official SDK](https://github.com/nessieisreal/nessie-javascript-sdk).
Older SDK routes can differ from the deployed sandbox; creation and read-back are verified live by the new seeder.

## Supabase retrieval database

Nessie remains the source of truth for accounts, transactions and bills. Supabase is a separate,
dated, read-only search mirror for the future chatbot. It does not replace the bank API or the
forecast engine, and browser decisions are still stored locally.

Fill the `SUPABASE_*` values in `.env.local` using `.env.example`. The database setup uses the
Supabase **session pooler** on port 5432 with certificate verification. The included certificate
is Supabase's public CA, not a private key. Keep the raw database password quoted; do not URL-encode it.

```bash
npm run db:setup      # apply the versioned schema once; reruns verify its checksum
npm run db:sync       # read both configured Nessie datasets and publish complete snapshots
npm run db:verify     # read-only checks of relationships, access, search and exact totals
```

The sync never writes to Nessie. It reuses identical snapshots; a failed import rolls back before
the active snapshot changes. Seven RLS-enabled tables hold datasets, snapshots, accounts, merchants,
bills, transactions and search documents. Anonymous and signed-in browser roles have no access.
The runtime secret can read but cannot edit these tables; migration credentials stay local.

`api/_knowledge.js` provides server-only full-text search and exact SQL activity totals, with source
IDs and data dates. Totals use all matching posted records, not only the top search results. Derived
income and goals are labeled estimates/defaults. A retrieval result is not proof that a forecast is
current: refresh Nessie before calculating a new scenario.

This is a retrieval foundation, **not a connected chatbot yet**. It has no embeddings, agent tools,
per-user authentication or public chat endpoint. Those must be added before personal data is served.
Never pass a dataset selected by the model directly to the helper; choose it from an authorized
session. Only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` would be needed by a future hosted chat route;
never expose secrets through `VITE_` variables or deploy the database password to the browser.

## Weather demo and browser checks

Choose **Dark** for a moonlit dashboard, **Light** for the daytime palette, or **Auto** to follow the
system. The choice persists. Controls are in the sidebar on desktop and the top bar on phones.
Weather follows the calculated balance, not the theme or the number of unread alerts.

1. Start from **Reset my decisions** (desktop) or **Reset demo** (phone).
2. On Today, choose **Review it** for the example internet notice.
3. Read the highlighted source and preview, then **Add this change to internet**: the projected low
   drops from $200 to $175 and rain begins.
4. Choose **Undo**: the change is removed and rain stops. Use Reset to restore the waiting example
   for another run. Reset only clears local decisions; it does not undo bank transactions.

The original demo returns to **partly cloudy**, not full sunshine: its $200 low is exactly its $200
cushion. We keep those numbers honest. Reduced-motion preferences replace animated rain with a
faint static treatment.

Playwright CLI checks covered all seven sections at desktop and phone sizes, both themes, system
theme changes, notice/preview/apply/cancel/Undo, reload persistence, transaction search/category
corrections, keyboard dismissal and reduced motion. Screenshots belong in ignored `output/playwright/`,
not in source control. No sandbox transfer was submitted during the browser run.

For repeat checks, run `npm run dev`, then open a fresh browser session:

```bash
npx --package @playwright/cli playwright-cli open http://127.0.0.1:5176/
```

Confirm the displayed data source; live API failures
fall back to the bundled sample. Verify a preview never changes the accepted plan, rain clears only
when the calculated dip clears, and phone transaction amounts are visible without sideways scrolling.

## How it works

Everything on every screen comes from one simulation. A household (facts from the bank) and a scenario (what the user is considering) go into `simulate()`, and the chart, the statuses, the supported contribution, the goal projection, the options and the alerts all read from its result. Change the bill increase and every number moves.

| File | What it does |
| --- | --- |
| `src/engine/forecast.js` | Day-by-day projection; `capacity()` searches for the largest contribution that keeps every day above the cushion |
| `src/engine/household.js` | Turns Nessie records into the household; enforces the three correctness rules |
| `src/engine/changes.js` | Reads a price change out of a provider notice, and drafts a question to send them |
| `src/engine/options.js` | Builds each response and previews it by simulation, not by rule of thumb |
| `src/engine/alerts.js` | One event, one alert |
| `api/household.js` | Nessie proxy, with the snapshot as fallback |
| `api/transfer.js` | Sandbox contribution: one per amount per day, status read back, half-completed pairs reported as such |
| `src/engine/plan.js` | One accepted plan plus per-change history, so Undo reverses one decision and nothing else |

## A goal is an amount by a date

Not "four contributions of $300" — a person does not think that way, and a contribution count hides
the question that matters. The date is the input; the number of contributions is a consequence of it.

Four separate measures, never blurred into one number:

| Measure | What it means |
| --- | --- |
| **Already saved** | What is actually in the account |
| **That date asks for** | Target minus saved, divided over the contributions the date allows |
| **Your plan can carry** | The largest contribution that keeps *every* day above the cushion |
| **Projected result** | Where the chosen plan actually lands, and by how much it misses |

When the date asks for more than the plan can carry, the app says so and offers exactly two paths,
because there are only two: **keep the date** and find the difference somewhere (an unprotected
allowance, a commitment you cancel), or **keep the spending** and accept a later date, named and
dated. Neither is free, and the app says which cost each one carries.

Both are checked across the whole goal horizon. `validatePlan()` simulates every bill and paycheck
from today to the last contribution — 247 days for a June goal, not a 34-day window multiplied out —
so a contribution that clears the cushion in October but fails at a February annual renewal is
reported as failing. `affordableOver()` searches for the largest contribution that survives all of
it. Every screen naming a goal total also names the date through which it was checked.

## Three plans, kept apart

The app distinguishes three things that used to blur together, and every screen reads the right one:

- **What the plan can carry** — the largest contribution that keeps every forecast day above the cushion.
- **What you accepted** — an option you applied. Only an option that actually sets a contribution changes the goal result.
- **What you are previewing** — drawn as a dashed line, committed to nothing.

A cancellation you have only *intended* sits in a fourth state: recorded, visible, and deliberately
excluded from the forecast until you confirm the provider actually did it.

Decisions persist in `localStorage` and survive reload. Undo reverses the last plan change only,
leaving unrelated decisions alone. "Reset my decisions" in the sidebar clears everything.

## Three rules the data layer enforces

1. **Transfers are not income.** Money moved between your own accounts never reaches the paycheck detector.
2. **A bill and its posted charge are one expense.** Every bill also lands as a purchase. Counting both doubled everyday spending and sent the forecast hundreds of dollars under.
3. **Repeat purchases are not a subscription.** Purchases only ever feed spending categories. Something becomes recurring only when the bank says it is a bill.

## Bringing in new information

Three ways a commitment reaches the forecast, and none of them happens without the user:

- **Import a notice.** RainCheck has no mailbox. It cannot see a price change in bank records
  either — a bank knows what posted, not what a provider intends to charge next month. So a notice
  exists only once you paste it and accept it, and the demo's example notice sits in "waiting to be
  reviewed" until then rather than quietly shaping the forecast. Paste an email about a price change. RainCheck reads the amount and the
  date, highlights the sentence it took them from, suggests which commitment it belongs to, and
  previews the consequence before anything is added. A notice it cannot read says so; a notice
  that names no commitment asks which one. Re-importing replaces rather than stacks.
- **Decide an unexplained charge.** A charge higher than usual is a question, not a price change.
- **Confirm a commitment found in spending.** A steady charge missing from the bank's bill list is
  proposed with its evidence. It is never added automatically: four rides in a month and a monthly
  subscription look alike until you check, and even then a bus fare can pass the test.

## What is not built

Said plainly so nothing here is mistaken for finished work:

- **Notifications outside the app.** Reminders are in-app only, with a lead time you choose, and
  they stop once you mark a charge paid. Nothing reaches your phone.
- **Notices beyond one sentence pattern.** The parser reads
  "…will renew at $X starting with your Month D bill." Anything else is reported as unreadable.
- **Income beyond the observed pattern.** Paychecks past the next three repeat the cadence the
  deposits show. The app says so wherever a long horizon depends on it, and it never invents
  irregular income.
- **Identity verification and voice.** Neither sponsor integration is wired up.

## What the app will not claim

- A charge that arrives higher is never called a price change. Only a notice can establish that, and the app shows the sentence. Otherwise it says the amount changed and it has not confirmed why, then asks whether it was one-time or the new price.
- Applying a plan updates the plan. It never moves money. The only transfer is on the Goals page, and its status is read back from the sandbox before it is shown as complete.
- A notice that has not been reviewed is not in the forecast, and the dashboard says it is waiting rather than showing it as something that happened.
- No option hides a cost. Moving money out of savings would fix checking while shrinking the goal, so it is not offered.

All financial data is mock data from Capital One's Nessie sandbox.
