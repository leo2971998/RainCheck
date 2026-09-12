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
npm test             # 60 tests, locked against the real sandbox snapshot
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
