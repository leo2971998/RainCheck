# RainCheck

RainCheck shows how changing bills affect your next payday and your savings goals, and lets you compare realistic adjustments before committing.

Built for HackRice 16 · Finance track · Capital One Nessie challenge.

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:5176
```

It starts on sample data with no setup. `npm run dev` also serves the `api/` folder the way Vercel does, so the live path can be tested locally.

```bash
npm test             # 42 tests, locked against the real sandbox snapshot
npm run build
```

## Connect the Capital One sandbox

1. Sign in at https://nessieisreal.com with GitHub and copy your key.
2. Seed a household and capture a snapshot: `node scripts/seed-nessie.mjs`. It prints the three account IDs it creates, and verifies that the seeded data reproduces the numbers the demo depends on. `node scripts/check-nessie.mjs` reports what a key can see without printing it.
3. Copy `.env.example` to `.env.local` and fill it in, then set `VITE_DATA_MODE=nessie`.

The base URL is `https://api.nessieisreal.com`. The `http://` address in Nessie's own docs times out.

Without a key the app reads `data/nessie-snapshot.json`, a real read-back from the sandbox, so it still works with no network.

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

## What is not built

Said plainly so nothing here is mistaken for finished work:

- **Importing your own notice.** The bundled notice demonstrates the flow; there is no paste-and-confirm path yet, and the parser matches one documented sentence pattern.
- **Reminders outside the app.** In-app alerts exist. There is no push delivery, no due-date reminder, and no lead-time preference.
- **Discovering subscriptions from spending.** Commitments come from the bank's bill records only.
- **Checking the whole goal horizon.** The contribution is proven across the forecast window and then assumed to continue; every screen showing the goal total says so.
- **Identity verification and voice.** Neither sponsor integration is wired up.

## What the app will not claim

- A charge that arrives higher is never called a price change. Only a notice can establish that, and the app shows the sentence. Otherwise it says the amount changed and it has not confirmed why, then asks whether it was one-time or the new price.
- Applying a plan updates the plan. It never moves money. The only transfer is on the Goals page, and its status is read back from the sandbox before it is shown as complete.
- No option hides a cost. Moving money out of savings would fix checking while shrinking the goal, so it is not offered.

All financial data is mock data from Capital One's Nessie sandbox.
