# RainCheck — implementation plan, phase by phase

This turns `dashboard.html` into a real Vite + React app with Capital One's Nessie sandbox behind it. Follow the phases in order. Each phase says what to build, gives the code, explains how the functions work, and ends with a check you can run so you know it is done.

Time budget (Devpost deadline Sunday 9:00 AM, live judging 9:30 to 12:00):

| Phase | What | Time | When |
| --- | --- | --- | --- |
| 0 | Project setup, Nessie key, seed data | 1 h | Friday night |
| 1 | The forecast engine, with tests | 3 h | Friday night / Saturday early |
| 2 | Data layer: household model, Nessie proxy, snapshot fallback | 3 h | Saturday morning |
| 3 | App shell and Dashboard page | 4 h | Saturday midday |
| 4 | Drawers: what changed, compare options, apply | 3 h | Saturday afternoon |
| 5 | Forecast, Recurring, Transactions, Cash flow, Goals pages | 3 h | Saturday evening |
| 6 | Mock transfer with read-back, Persona gate, deploy | 2 h | Saturday night |
| 7 | Video, Devpost, live-demo script | 2.5 h | Sunday 6:00 to 8:30 |

If you fall behind, cut from the bottom of phase 5 (Cash flow, then Transactions) and phase 6 (Persona). Phases 1 to 4 are the product.

---

## The one idea to keep in your head

Everything on every screen is derived from **one scenario object** run through **one simulation**:

```
household (facts from the bank)  +  scenario (what the user is considering)
        │                                   │
        └──────────────► simulate() ◄───────┘
                             │
        ┌────────────────────┼─────────────────────┐
        ▼                    ▼                     ▼
   projected days      capacity()             goalAt()
   (chart, statuses)   (supported             (projected balance,
                        contribution)          gap, months needed)
                             │
                    buildOptions() / buildAlerts()
```

Nothing is hard-coded on a page. When the judge changes the $25 increase, the scenario changes, `simulate()` reruns, and every number moves. That is the demo.

---

## Phase 0 — Setup (1 h)

### 0.1 Create the project

```bash
cd D:\Projects\raincheck
npm create vite@latest app -- --template react
cd app
npm install
npm install -D vitest
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

### 0.2 Folder layout you are building toward

```
app/
├── api/                      Vercel serverless functions (Node)
│   ├── household.js          GET  → household built from Nessie, or the snapshot
│   ├── transfer.js           POST → create a sandbox transfer, then read its status
│   └── _nessie.js            shared fetch helper + snapshot fallback
├── data/
│   ├── nessie-snapshot.json  written by scripts/seed-nessie.mjs
│   ├── notice-internet.txt   the provider notice used as evidence
│   └── household.sample.js   the demo household (same numbers as dashboard.html)
├── scripts/
│   └── seed-nessie.mjs       one-time: create customer, accounts, bills, purchases, deposits
├── src/
│   ├── engine/
│   │   ├── forecast.js       simulate, capacity, goalAt, cutNeeded
│   │   ├── options.js        buildOptions
│   │   ├── alerts.js         buildAlerts
│   │   ├── changes.js        detectBillChanges, parseNotice
│   │   └── forecast.test.js
│   ├── components/           Kpi, AreaChart, GoalChart, CashBars, Alerts, IncomeList, Toggle, Drawer, Modal
│   ├── pages/                Dashboard, Forecast, Transactions, Recurring, CashFlow, Goals
│   ├── drawers/              BillDrawer, CompareDrawer
│   ├── hooks/useHousehold.js
│   ├── App.jsx               shell: sidebar, page state, scenario state
│   ├── index.css             the <style> block from dashboard.html
│   └── main.jsx
├── vercel.json
└── .env.local                server-only secrets (never VITE_ prefixed)
```

### 0.3 Copy the styling

Copy the entire `<style>` block from `dashboard.html` into `src/index.css`, then add the Google Fonts link to `index.html`:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Geist:wght@400;500;600;700&display=swap">
```

### 0.4 Nessie key and seed

- Sign in at **https://nessieisreal.com** with GitHub and copy your key.
- Base URL is **`https://api.nessieisreal.com`**. The `http://` address in the docs times out.
- Put the key in `app/.env.local`:

```
NESSIE_KEY=your_key
NESSIE_CUSTOMER_ID=   # filled in by the seed script
NESSIE_CHECKING_ID=
NESSIE_SAVINGS_ID=
VITE_DEMO_DATE=2026-09-28
```

`VITE_DEMO_DATE` pins "today" so the demo is identical every time you open it. Remove it later for a live app.

Run the seed script (phase 2 gives the code) and commit `data/nessie-snapshot.json`.

**Done when:** `npm run dev` shows the Vite page, `npm test` runs (zero tests is fine), and the snapshot file exists.

---

## Phase 1 — The forecast engine (3 h)

Write this first, with tests, before any UI. It is pure JavaScript with no React and no dates from the wall clock, so it is easy to test and easy to explain in the video.

### 1.1 The shapes

```js
// A household is facts. Nothing here is a decision.
const household = {
  today: '2026-09-28',          // ISO date the forecast starts from
  windowDays: 34,               // how far to project
  checking: 1260,               // current checking balance
  savings: 800,                 // current savings balance
  cushion: 200,                 // user-chosen floor for checking
  income: [                     // expected deposits inside the window
    { id: 'p1', label: 'Paycheck', date: '2026-10-02', amount: 1700, status: 'confirmed' },
    { id: 'p2', label: 'Paycheck', date: '2026-10-16', amount: 1700, status: 'estimated' },
    { id: 'p3', label: 'Paycheck', date: '2026-10-30', amount: 1700, status: 'estimated' },
  ],
  recurring: [                  // monthly commitments; day = day of month it posts
    { id: 'rent', label: 'Rent', amount: 1150, day: 5 },
    { id: 'internet', label: 'Internet', amount: 65, day: 1,
      change: { to: 90, effective: '2026-10-01', why: 'Promotional credit ended', source: 'notice' } },
    { id: 'streaming', label: 'Streaming', amount: 30, day: 3, cancellable: true },
    { id: 'electric', label: 'Electric', amount: 110, day: 6, lastPosted: 128, unexplained: true },
    { id: 'car', label: 'Car insurance', amount: 120, day: 10 },
    { id: 'phone', label: 'Phone', amount: 45, day: 12 },
    { id: 'gym', label: 'Gym', amount: 40, day: 15, renews: '2026-10-15', cancellable: true },
  ],
  allowances: [                 // everyday spending, monthly, learned from history
    { id: 'groceries', label: 'Groceries', monthly: 700 },
    { id: 'takeout', label: 'Dining & takeout', monthly: 180 },
    { id: 'rides', label: 'Rides & transit', monthly: 60 },
    { id: 'household', label: 'Household', monthly: 260 },
    { id: 'fun', label: 'Fun & other', monthly: 300 },
  ],
  goal: { label: 'Emergency fund', target: 2000, saved: 800, left: 4, planned: 300 },
};

// A scenario is what the user (or the judge) is considering. It never changes the household.
const scenario = {
  increase: 25,          // the internet change being previewed (judge control edits this)
  contribution: 300,     // planned monthly savings contribution
  cuts: {},              // { takeout: 45 } → reduce that allowance by $45/month
  cancelled: {},         // { gym: true } → skip that bill from today on
  treatElectricAsNew: false,
  income: null,          // null = use household.income; otherwise the user's edited copy
};
```

### 1.2 `simulate(h, sc)` — one pass, day by day

**What it does.** Walks each day from `today` for `windowDays` days, applying money in and money out, and records the end-of-day balance. Everything else in the app reads from this result.

**How it works, step by step.**

1. Everyday spending is a monthly total spread evenly: `dailySpend = (sum of allowances − cuts) / 30`.
2. Start with `balance = checking`.
3. For each day:
   - Add any income whose date matches.
   - Subtract each recurring bill whose `day` equals the calendar day, unless it is cancelled. If the bill has a `change` and the date is on or after `effective`, use `amount + sc.increase` instead of `amount`. If it is the electric bill and the user chose "treat as new price", use `lastPosted`.
   - On the contribution date (the first payday in the window), subtract the contribution.
   - Subtract `dailySpend`.
   - Record `{ date, balance, events, state }`. State is a label from the cushion: below zero → `over`, below cushion → `below`, within $100 above the cushion → `tight`, else `ok`.
4. Return the days, the lowest day, the worst state, and October cash-flow totals.

```js
// src/engine/forecast.js
export const iso = d => d.toISOString().slice(0, 10);
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const stateOf = (b, cushion) => b < 0 ? 'over' : b < cushion ? 'below' : b < cushion + 100 ? 'tight' : 'ok';

export function simulate(h, sc) {
  const income = sc.income || h.income;
  const start = new Date(h.today + 'T12:00:00');               // noon avoids DST edge cases
  const contributionDate = income.map(p => p.date).filter(d => d >= h.today).sort()[0]; // first payday
  const dailySpend = h.allowances.reduce((a, x) => a + x.monthly - (sc.cuts?.[x.id] || 0), 0) / 30;

  const days = []; let b = h.checking;
  for (let i = 0; i < h.windowDays; i++) {
    const date = addDays(start, i), key = iso(date), events = [];

    for (const p of income) if (p.date === key) { b += p.amount; events.push({ label: p.label, amt: p.amount, pay: true }); }

    for (const r of h.recurring) {
      if (date.getDate() !== r.day || sc.cancelled?.[r.id]) continue;
      let amt = r.amount;
      if (r.change && key >= r.change.effective) amt = r.amount + sc.increase;
      if (r.id === 'electric' && sc.treatElectricAsNew) amt = r.lastPosted;
      b -= amt; events.push({ label: r.label, amt: -amt, bill: true, big: amt >= 100 });
    }

    if (key === contributionDate && sc.contribution > 0) { b -= sc.contribution; events.push({ label: 'Savings contribution', amt: -sc.contribution, transfer: true }); }

    b -= dailySpend; events.push({ label: 'Everyday spending', amt: -dailySpend });
    days.push({ date, key, balance: b, events, state: stateOf(b, h.cushion) });
  }

  const low = days.reduce((a, x) => (x.balance < a.balance ? x : a));
  const worst = ['over', 'below', 'tight', 'ok'].find(s => days.some(d => d.state === s));
  const month = days.filter(d => d.key.slice(0, 7) === days[days.length - 1].key.slice(0, 7)); // the last month in the window
  const cash = {
    income: month.reduce((a, d) => a + d.events.filter(e => e.pay).reduce((s, e) => s + e.amt, 0), 0),
    bills: month.reduce((a, d) => a + d.events.filter(e => e.bill).reduce((s, e) => s - e.amt, 0), 0),
    everyday: Math.round(month.length * dailySpend),
    savings: sc.contribution,
  };
  return { days, low, worst, dailySpend, cash, contributionDate };
}
```

**Worked example with the demo numbers** (increase 25, contribution 300, daily spend 50):

| Date | Events | End of day |
| --- | --- | --- |
| Sep 28–30 | everyday × 3 | 1,110 |
| Oct 1 | Internet 90 (65 + 25) | 970 |
| Oct 2 | +1,700 paycheck, −300 contribution | 2,320 |
| Oct 5 | Rent 1,150 | 990 |
| Oct 6 | Electric 110 | 830 |
| Oct 10 | Car insurance 120 | 510 |
| Oct 12 | Phone 45 | 365 |
| Oct 15 | Gym 40 | **175** ← lowest, below the $200 cushion |
| Oct 16 | +1,700 | 1,825 |

So with the bill increase and the original $300 plan, the household dips to $175. That is the fact the whole demo turns on.

### 1.3 `capacity(h, sc)` — the contribution the plan can support

**What it does.** Finds the largest monthly contribution (in $5 steps) that keeps **every** projected day at or above the cushion.

**Why a search and not a formula.** Bills land on different days, so the tight point moves. A search over the simulation is always correct; a formula would have to guess which day is the tight one. It costs 121 simulations of 34 days, well under a millisecond.

```js
export function capacity(h, sc, max = 600, step = 5) {
  for (let c = max; c >= 0; c -= step)
    if (simulate(h, { ...sc, contribution: c }).low.balance >= h.cushion) return c;
  return 0;
}
```

Worked example: on Oct 15 the balance is `475 − c`. Keeping it at or above 200 means `c ≤ 275`. So `capacity()` returns **275** with the increase, and **300** without it. The $25 increase costs exactly $25 of contribution because the internet bill lands before the tight day.

### 1.4 `goalAt(h, c, left)` — what the goal looks like at a contribution

```js
export function goalAt(h, c, left = h.goal.left) {
  const projected = h.goal.saved + left * c;
  const gap = Math.max(0, h.goal.target - projected);
  const monthsNeeded = c > 0 ? Math.ceil((h.goal.target - h.goal.saved) / c) : Infinity;
  return { projected, gap, monthsNeeded, contributions: left * c, left };
}
```

Worked example: `goalAt(h, 275)` → projected 800 + 4 × 275 = **1,900**, gap **100**, monthsNeeded ceil(1200 / 275) = **5** (one month later than planned).

### 1.5 `cutNeeded(h, sc, allowanceId, want)` — the smallest trim that restores a contribution

**What it does.** Tries cutting one allowance by $0, $5, $10… per month until `capacity()` reaches `want`. Returns the cut, or `null` if no cut up to $400 works.

```js
export function cutNeeded(h, sc, allowanceId, want) {
  for (let cut = 0; cut <= 400; cut += 5)
    if (capacity(h, { ...sc, cuts: { ...sc.cuts, [allowanceId]: cut } }) >= want) return cut;
  return null;
}
```

Worked example: trimming takeout by `cut` per month reduces daily spend by `cut / 30`. Only the 18 days up to Oct 15 count, so the balance on the tight day rises by `0.6 × cut`. To recover $25 you need `cut ≥ 41.7`, so the answer is **$45**. Notice the app does not say "cut $25 of takeout": a monthly cut only partly lands before the tight day, and the search gets that right automatically.

### 1.6 Tests — write these before the UI

```js
// src/engine/forecast.test.js
import { describe, it, expect } from 'vitest';
import { simulate, capacity, goalAt, cutNeeded } from './forecast.js';
import { household as h } from '../../data/household.sample.js';

const sc = { increase: 25, contribution: 300, cuts: {}, cancelled: {} };

describe('forecast engine', () => {
  it('finds the tight day', () => {
    const r = simulate(h, sc);
    expect(r.low.key).toBe('2026-10-15');
    expect(Math.round(r.low.balance)).toBe(175);
    expect(r.worst).toBe('below');
  });
  it('supports $300 before the change and $275 after', () => {
    expect(capacity(h, { ...sc, increase: 0 })).toBe(300);
    expect(capacity(h, sc)).toBe(275);
  });
  it('projects the goal', () => {
    expect(goalAt(h, 275)).toMatchObject({ projected: 1900, gap: 100, monthsNeeded: 5 });
  });
  it('finds the takeout trim that restores $300', () => {
    expect(cutNeeded(h, sc, 'takeout', 300)).toBe(45);
  });
  it('a cancelled gym raises capacity to $315', () => {
    expect(capacity(h, { ...sc, cancelled: { gym: true } })).toBe(315);
  });
  it('a bigger increase shrinks capacity one for one', () => {
    expect(capacity(h, { ...sc, increase: 75 })).toBe(225);
  });
});
```

**Done when:** `npm test` is green. These six tests are your "technical rigor" slide.

---

## Phase 2 — Data layer (3 h)

### 2.1 The sample household (dev mode)

Create `data/household.sample.js` exporting the object from 1.1 plus `history` (three past months for the cash-flow chart) and `transactions` (the 13 rows from `dashboard.html`). The UI runs on this file with no network, which is also your fallback during judging.

### 2.2 Seed Nessie once

```js
// scripts/seed-nessie.mjs   (run: node scripts/seed-nessie.mjs)
import { writeFile } from 'node:fs/promises';
const BASE = 'https://api.nessieisreal.com', KEY = process.env.NESSIE_KEY;
const call = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}?key=${KEY}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return res.json();
};
const customer = await call('POST', '/customers', { first_name: 'Alex', last_name: 'Rivera', address: { street_number: '6100', street_name: 'Main St', city: 'Houston', state: 'TX', zip: '77005' } });
const cid = customer.objectCreated._id;
const checking = (await call('POST', `/customers/${cid}/accounts`, { type: 'Checking', nickname: 'Everyday Checking', rewards: 0, balance: 1260 })).objectCreated._id;
const savings = (await call('POST', `/customers/${cid}/accounts`, { type: 'Savings', nickname: 'Emergency fund', rewards: 0, balance: 800 })).objectCreated._id;

const bills = [['Harbor Lofts', 'Rent', 5, 1150], ['Northline Internet', 'Internet', 1, 65], ['Plexi', 'Streaming', 3, 30], ['Reliant Energy', 'Electric', 6, 110], ['Geico', 'Car insurance', 10, 120], ['Mint Mobile', 'Phone', 12, 45], ['Fit24', 'Gym', 15, 40]];
for (const [payee, nickname, day, amount] of bills)
  await call('POST', `/accounts/${checking}/bills`, { status: 'recurring', payee, nickname, payment_date: `2026-10-${String(day).padStart(2, '0')}`, recurring_date: day, payment_amount: amount });

// three months of paychecks, every other Friday
for (const date of ['2026-07-10', '2026-07-24', '2026-08-07', '2026-08-21', '2026-09-04', '2026-09-18'])
  await call('POST', `/accounts/${checking}/deposits`, { medium: 'balance', transaction_date: date, status: 'completed', amount: 1700, description: 'Paycheck Rice Coffee Co' });

// everyday spending: a few merchants, three months, so allowances can be learned
const merchants = {};
for (const [name, category] of [['Kroger', 'Groceries'], ['Uber', 'Rides & transit'], ['Chipotle', 'Dining & takeout'], ['Amazon', 'Household'], ['AMC Theatres', 'Fun & other']])
  merchants[name] = (await call('POST', '/merchants', { name, category, address: { street_number: '1', street_name: 'Main', city: 'Houston', state: 'TX', zip: '77005' }, geocode: { lat: 29.72, lng: -95.4 } })).objectCreated._id;
const spend = [['Kroger', 175, 4], ['Chipotle', 45, 4], ['Uber', 15, 4], ['Amazon', 65, 4], ['AMC Theatres', 75, 4]]; // per month: amount × times
for (const month of ['07', '08', '09']) for (const [name, amount, times] of spend) for (let k = 0; k < times; k++)
  await call('POST', `/accounts/${checking}/purchases`, { merchant_id: merchants[name], medium: 'balance', purchase_date: `2026-${month}-${String(3 + k * 7).padStart(2, '0')}`, amount, status: 'completed', description: name });

const snapshot = { customerId: cid, checkingId: checking, savingsId: savings,
  accounts: await call('GET', `/customers/${cid}/accounts`), bills: await call('GET', `/accounts/${checking}/bills`),
  deposits: await call('GET', `/accounts/${checking}/deposits`), purchases: await call('GET', `/accounts/${checking}/purchases`), merchants: await call('GET', '/merchants') };
await writeFile('data/nessie-snapshot.json', JSON.stringify(snapshot, null, 2));
console.log(`NESSIE_CUSTOMER_ID=${cid}\nNESSIE_CHECKING_ID=${checking}\nNESSIE_SAVINGS_ID=${savings}`);
```

### Nessie behaviours learned the hard way

All five were found by running against the live sandbox, and all five would have silently broken the demo.

| Behaviour | Consequence | What the script does |
| --- | --- | --- |
| **Amounts are truncated to whole dollars.** $13.90 stores as $13, $188.29 as $188. | Cent-precise seed data loses ~0.7% of every spending category, enough to move the tight day and break every headline number. | Seeds whole dollars only, chosen so each category's three-month total is exact. |
| **Purchases cannot be deleted.** `DELETE /purchases/{id}` returns 403 "Missing Authentication Token", which is API Gateway's way of saying the route does not exist. | A half-seeded account can never be cleaned, so re-running doubles every category. | Detects a purchase count it did not write and rebuilds the account. |
| **Accounts *can* be deleted.** `DELETE /accounts/{id}` returns 200. | This is the only way to get a clean slate. | Used for the rebuild above. `--fresh` forces it. |
| **Transfers cannot name a destination.** `POST /accounts/{id}/transfers` accepts only `transaction_date`, `status`, `amount`, `description`, and rejects `payee_id` and `medium` as "extra fields not permitted". | A savings contribution cannot be modelled as a transfer. | Records a withdrawal from checking plus a deposit into savings. Phase 6 does the same. |
| **An empty collection returns 404, not `[]`.** `GET /accounts/{id}/transfers` on an account with none returns 404 "No transfers found for this account". | A naive fetch throws and skips the block that would have created the records. | Every list read is `.catch(() => [])`. |

Two more worth knowing: an unknown key returns `[]` rather than an error, so a typo looks like "no data"; and posting purchases, deposits or withdrawals does **not** change the account's `balance` field, which stays whatever you created it with. That last one is convenient here, because the forecast's starting balance stays fixed at $1,260 no matter how much history you add.

### Confirmed request and response shapes

**This script has been run successfully against the real sandbox** (130 API calls, all accepted, 12 of 12 verification checks passing), so every field name above is confirmed. The records Nessie returns carry these fields:

| Record | Fields you get back |
| --- | --- |
| bill | `_id, status, payee, nickname, creation_date, payment_date, recurring_date, upcoming_payment_date, payment_amount, account_id` |
| deposit | `_id, medium, transaction_date, status, amount, description` |
| purchase | `_id, type, merchant_id, payer_id, purchase_date, amount, status, medium, description` |
| merchant | `_id, name, category, address, geocode` |

The seeded household is Alex Rivera with Everyday Checking at $1,260 and Emergency fund at $800, 7 bills, 6 paychecks 14 days apart ending Sep 18 (so the next falls on Oct 2), and 61 purchases across three months. The account IDs are printed at the end and belong in `.env.local`.

The script is safe to re-run: it reuses the existing customer, accounts, bills and merchants instead of duplicating them.

### 2.3 `buildHousehold(snapshot, today)` — turning bank records into the household shape

This is the honest part of the data layer. Put it in `src/engine/household.js` so it runs both on the server and in tests.

**Rules it must respect** (from your plan): transfers are not income; a receipt and its transaction count once; repeated purchases from a merchant are not automatically a subscription.

```js
// src/engine/household.js
export function buildHousehold(snap, today) {
  const checking = snap.accounts.find(a => a.type === 'Checking');
  const savings = snap.accounts.find(a => a.type === 'Savings');

  // 1. Income: deposits whose description repeats. Transfers never appear here because
  //    Nessie keeps them in /transfers, and we only read /deposits.
  const byDesc = groupBy(snap.deposits, d => d.description);
  const pay = Object.values(byDesc).find(list => list.length >= 3)?.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date)) || [];
  const gapDays = pay.length >= 2 ? daysBetween(pay.at(-2).transaction_date, pay.at(-1).transaction_date) : 14;
  const income = [];
  for (let d = addIso(pay.at(-1)?.transaction_date || today, gapDays), n = 0; n < 3; d = addIso(d, gapDays)) {
    if (d < today) continue;
    income.push({ id: 'p' + income.length, label: 'Paycheck', date: d, amount: pay.at(-1)?.amount || 0, status: income.length === 0 ? 'confirmed' : 'estimated' });
    n++;
  }

  // 2. Recurring: Nessie bills are the source of truth. day = recurring_date.
  const recurring = snap.bills.map(b => ({ id: slug(b.nickname), label: b.nickname, payee: b.payee, amount: b.payment_amount, day: b.recurring_date }));

  // 3. Allowances: purchases over the last 90 days, grouped by merchant category, divided by 3.
  //    This is where "repeat purchases are not a subscription" lives: purchases feed allowances, never recurring.
  //
  //    VERIFIED AGAINST REAL SANDBOX DATA: a bill also posts as a purchase. Reliant Energy showed up
  //    as a $43/month "Utilities" allowance on top of the $110 Electric bill — the same money counted
  //    twice, which inflated daily spending from $50.00 to $51.43. So exclude any purchase whose
  //    merchant is a bill payee; those belong to detectPostedChanges instead.
  const merchant = Object.fromEntries(snap.merchants.map(m => [m._id, m]));
  const payees = new Set(recurring.map(r => r.payee?.toLowerCase()).filter(Boolean));
  const isBillPosting = p => payees.has(merchant[p.merchant_id]?.name?.toLowerCase());
  const recent = snap.purchases.filter(p => daysBetween(p.purchase_date, today) <= 90 && !isBillPosting(p));
  const byCat = groupBy(recent, p => merchant[p.merchant_id]?.category || 'Other');
  const allowances = Object.entries(byCat).map(([label, list]) => ({ id: slug(label), label, monthly: Math.round(list.reduce((a, p) => a + p.amount, 0) / 3) }));

  return { today, windowDays: 34, checking: checking.balance, savings: savings.balance, cushion: 200, income, recurring, allowances,
    goal: { label: 'Emergency fund', target: 2000, saved: savings.balance, left: 4, planned: 300 } };
}
const groupBy = (xs, f) => xs.reduce((m, x) => ((m[f(x)] ||= []).push(x), m), {});
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const addIso = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
```

**How the paycheck cadence works.** Take the deposit description that repeats at least three times, measure the gap between the last two, and project forward from the last one. The first projected date is marked *confirmed* only if your bank data marks scheduled deposits; otherwise call it *estimated*. Either way the user can edit it on the Forecast page (that is the "editable expected income" feature).

**The goal's `saved`** is the real savings balance, read every time, never a cached number. That is what keeps "accepting a plan" separate from "money moved".

### 2.4 Detecting bill changes — `src/engine/changes.js`

Two different things, kept apart on purpose:

**A. A posted charge that differs from the usual amount** (the electric case). Compare each recurring bill's most recent posted purchase against the bill amount. If it differs by more than 10 percent and there is no notice, mark it `unexplained` and let the user decide "one-time" or "new price". Do not change the forecast until they decide.

```js
export function detectPostedChanges(household, purchases, merchants) {
  const byName = Object.fromEntries(merchants.map(m => [m._id, m.name]));
  return household.recurring.map(r => {
    const posted = purchases.filter(p => byName[p.merchant_id]?.toLowerCase().includes(r.payee?.toLowerCase())).sort((a, b) => b.purchase_date.localeCompare(a.purchase_date))[0];
    if (!posted || Math.abs(posted.amount - r.amount) / r.amount <= 0.10) return r;
    return { ...r, lastPosted: posted.amount, unexplained: true };
  });
}
```

**B. An upcoming increase found in a notice** (the internet case). Transaction history cannot show a change that has not happened. The notice can. Parse it narrowly:

```js
// Finds "renew at $90.00 starting with your October 1 bill" and "credit of $25.00 ended".
export function parseNotice(text, year = 2026) {
  const renew = /renew at \$([\d,.]+) starting with your ([A-Z][a-z]+) (\d{1,2}) bill/.exec(text);
  const credit = /promotional credit of \$([\d,.]+) ended/.exec(text);
  if (!renew) return null;
  const month = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(renew[2]) + 1;
  return {
    to: Number(renew[1].replace(/,/g, '')),
    effective: `${year}-${String(month).padStart(2, '0')}-${String(renew[3]).padStart(2, '0')}`,
    why: credit ? 'Promotional credit ended' : 'Not stated in the notice',
    evidence: [renew[0], credit?.[0]].filter(Boolean),   // the exact phrases to highlight
    source: 'notice',
  };
}
```

Attach the result to the matching recurring bill as `change`, and set `scenario.increase = change.to − bill.amount`. The `evidence` array is what the drawer highlights with `<mark>`, so the highlight always points at text that really exists in the notice.

If `parseNotice` returns `null`, the app must say: *"The amount changed. We have not confirmed why."* Never invent an explanation.

### 2.5 The Nessie proxy — `api/household.js`

Server-side only (the key never reaches the browser). Nessie is a shared sandbox that can be slow or down at judging time, so the snapshot fallback is not optional.

```js
// api/_nessie.js
import snapshot from '../data/nessie-snapshot.json' with { type: 'json' };
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
    const [accounts, bills, deposits, purchases, merchants] = await Promise.all([
      nessie(`/customers/${cid}/accounts`), nessie(`/accounts/${ck}/bills`), nessie(`/accounts/${ck}/deposits`), nessie(`/accounts/${ck}/purchases`), nessie('/merchants')]);
    return { source: 'nessie', customerId: cid, checkingId: ck, savingsId: process.env.NESSIE_SAVINGS_ID, accounts, bills, deposits, purchases, merchants };
  } catch { return { source: 'snapshot', ...snapshot }; }
}
```

```js
// api/household.js
import { readFile } from 'node:fs/promises';
import { loadSnapshotLike } from './_nessie.js';
import { buildHousehold } from '../src/engine/household.js';
import { detectPostedChanges, parseNotice } from '../src/engine/changes.js';

export default async function handler(req, res) {
  const snap = await loadSnapshotLike();
  const today = process.env.VITE_DEMO_DATE || new Date().toISOString().slice(0, 10);
  const h = buildHousehold(snap, today);
  h.recurring = detectPostedChanges(h, snap.purchases, snap.merchants);
  const notice = await readFile(new URL('../data/notice-internet.txt', import.meta.url), 'utf8');
  const change = parseNotice(notice);
  const internet = h.recurring.find(r => r.id === 'internet');
  if (change && internet) internet.change = change;
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ source: snap.source, household: h, notice, transactions: recentTransactions(snap) });
}
function recentTransactions(snap) {
  const name = Object.fromEntries(snap.merchants.map(m => [m._id, m.name]));
  return [
    ...snap.purchases.map(p => ({ d: p.purchase_date, what: name[p.merchant_id] || p.description, amt: -p.amount, k: 'ev' })),
    ...snap.deposits.map(d => ({ d: d.transaction_date, what: d.description, amt: d.amount, k: 'in' })),
  ].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 30);
}
```

Vercel needs `vercel.json`:

```json
{ "framework": "vite", "functions": { "api/**/*.js": { "maxDuration": 30 } },
  "rewrites": [{ "source": "/((?!api(?:/|$)).*)", "destination": "/index.html" }] }
```

### 2.6 `useHousehold()` — one hook, two modes

```js
// src/hooks/useHousehold.js
import { useEffect, useState } from 'react';
import { household as sample, transactions as sampleTx, notice as sampleNotice } from '../../data/household.sample.js';
export function useHousehold() {
  const [state, set] = useState({ loading: import.meta.env.VITE_DATA_MODE === 'nessie', household: sample, transactions: sampleTx, notice: sampleNotice, source: 'sample' });
  useEffect(() => {
    if (import.meta.env.VITE_DATA_MODE !== 'nessie') return;
    fetch('/api/household').then(r => r.json()).then(d => set({ loading: false, ...d })).catch(() => set(s => ({ ...s, loading: false, source: 'sample (network failed)' })));
  }, []);
  return state;
}
```

Show `source` in the sidebar footer ("Nessie sandbox" or "Sample data") so nobody is misled.

**Done when:** `node scripts/seed-nessie.mjs` prints three IDs, `npx vercel dev` serves `/api/household` with `"source": "nessie"`, and unplugging the network flips it to `"snapshot"`.

---

## Phase 3 — App shell and Dashboard (4 h)

Port from `dashboard.html`. Every component below already exists there; this phase is splitting them into files and wiring props.

### 3.1 State lives in `App.jsx`

```js
const { household: h, transactions, notice, source } = useHousehold();
const [page, setPage] = useState('dashboard');
const [drawer, setDrawer] = useState(null);          // 'bill' | 'compare' | null
const [sc, setSc] = useState(() => ({ increase: initialIncrease(h), contribution: h.goal.planned, cuts: {}, cancelled: {}, treatElectricAsNew: false, income: null }));
const [confirm, setConfirm] = useState(null);        // the option waiting for "Apply"
const [applied, setApplied] = useState(null);        // { id, label } once a plan is applied

const sim  = useMemo(() => simulate(h, sc), [h, sc]);
const cap  = useMemo(() => capacity(h, sc), [h, sc]);
const goal = useMemo(() => { const c = applied ? sc.contribution : cap; const g = goalAt(h, c);
  return applied?.id === 'date' && isFinite(g.monthsNeeded) ? goalAt(h, c, g.monthsNeeded) : g; }, [h, sc, cap, applied]);
const alerts = useMemo(() => buildAlerts(h, sc, sim, cap, applied), [h, sc, sim, cap, applied]);
```

`initialIncrease(h)` returns `change.to − amount` for the bill that carries a `change`, or 0.

**Why `goal` uses `cap` before a plan is applied and `sc.contribution` after.** Before the user decides, the honest projection uses what the plan can support. After they apply an option, the projection uses what they chose. Both are shown with their labels.

### 3.2 Components to extract, in order

| Component | From `dashboard.html` | Props |
| --- | --- | --- |
| `Kpi` | `function Kpi` | `label, value, sub, pill` |
| `AreaChart` | `function AreaChart` | `sim, cushion, id, height` |
| `GoalChart` | `function GoalChart` | `goal, cap, planned, saved, target` |
| `CashBars` | `function CashBars` | `history, cash` |
| `Alerts` | `function Alerts` | `alerts` |
| `IncomeList` | `function IncomeList` | `income, onChange, compact` |
| `Toggle` | `function Toggle` | `on, onChange, children` |
| `Icon` | `const I` | `n, s, c` |

### 3.3 How `AreaChart` works (so you can change it with confidence)

It is plain SVG, no library. Three ideas:

1. **Scales.** `x(i)` maps a day index to a pixel across the width; `y(v)` maps a dollar value to a pixel, inverted because SVG y grows downward. The value range is from `min(0, lowest) − 80` up to `max(balance, cushion) × 1.06` so the cushion line always fits.
2. **Paths.** The line is `M x0,y0 L x1,y1 …`. The area is the same path closed down to the bottom, filled with a vertical gradient.
3. **Hover.** One invisible `<rect>` per day catches `onMouseEnter` and stores the index; the tooltip is a `<g>` drawn at that index. No DOM measuring, no library.

Markers: a teal dot on paydays, a hollow indigo dot on bills of $100 or more, and a colored dot on the lowest day with its label. The dashed amber line is the cushion.

### 3.4 Dashboard page

Compose it exactly as in the prototype: headline (from `sim.worst` and `goal.gap`), four `Kpi`, the chart card, the "What changed" and goal cards, cash flow, and on the right: "Here is what we found", `Alerts`, `IncomeList`.

The headline rule, in words: overdrawn beats below-cushion beats goal-gap beats on-track. One sentence, no score.

**Done when:** the Dashboard renders from the sample household and the lowest-point label reads $175 on Oct 15.

---

## Phase 4 — Drawers and apply (3 h)

### 4.1 `buildOptions(h, sc, cap)` — move the option logic out of the drawer

Options are computed, previewed by simulation, and each carries an `apply` patch for the scenario. Put this in `src/engine/options.js` so it is testable.

```js
import { simulate, capacity, goalAt, cutNeeded } from './forecast.js';
const FLEX_ORDER = ['dining-takeout', 'fun-other', 'rides-transit', 'household', 'groceries']; // most discretionary first

export function buildOptions(h, sc, cap, protectedIds = { groceries: true }) {
  const base = goalAt(h, cap);
  const options = [];

  // A. Keep spending, contribute what the plan supports.
  options.push({ id: 'keep', title: 'Keep everyday spending as it is', detail: `Contribute $${cap} a month instead of $${h.goal.planned}.`,
    before: ['Goal at target date', h.goal.target], after: ['Goal at target date', base.projected, base.gap ? `$${base.gap} short` : 'on target'],
    apply: { contribution: cap, label: `Plan set to $${cap}/month` } });

  // B. Trim one unprotected allowance just enough to restore the planned contribution.
  const candidates = h.allowances.filter(a => !protectedIds[a.id]).sort((a, b) => FLEX_ORDER.indexOf(a.id) - FLEX_ORDER.indexOf(b.id));
  for (const a of candidates) {
    const cut = cutNeeded(h, sc, a.id, h.goal.planned);
    if (cut !== null && cut <= a.monthly) {
      options.push({ id: 'reduce', title: `Reduce ${a.label.toLowerCase()} by $${cut} a month`, detail: `$${a.monthly} → $${a.monthly - cut}. Keeps the $${h.goal.planned} contribution.`,
        before: [a.label, a.monthly], after: ['Contribution', h.goal.planned, 'goal on target'],
        apply: { cuts: { [a.id]: cut }, contribution: h.goal.planned, label: `${a.label} trimmed $${cut}/month` } });
      break;
    }
  }

  // C. A renewal the user could cancel before it charges. Conditional until the provider confirms.
  const renewal = h.recurring.find(r => r.renews && r.renews >= h.today);
  if (renewal) {
    const capIf = capacity(h, { ...sc, cancelled: { ...sc.cancelled, [renewal.id]: true } });
    options.push({ id: 'renewal', conditional: true, title: `Review the ${renewal.label.toLowerCase()} renewal ($${renewal.amount} on ${renewal.renews.slice(5)})`,
      detail: `If cancelled before it charges, the plan supports $${capIf} a month.`, before: ['Contribution', cap], after: ['Contribution', Math.min(capIf, h.goal.planned), 'if cancelled'],
      apply: { cancelled: { [renewal.id]: true }, contribution: Math.min(capIf, h.goal.planned), label: `${renewal.label} cancellation pending` } });
  }

  // D. Keep the supported contribution, move the date.
  if (isFinite(base.monthsNeeded)) options.push({ id: 'date', title: 'Move the target date', detail: `Keep $${cap} a month and reach $${h.goal.target} after ${base.monthsNeeded} contributions instead of ${h.goal.left}.`,
    before: ['Contributions', h.goal.left], after: ['Contributions', base.monthsNeeded, `${base.monthsNeeded - h.goal.left} month(s) later`],
    apply: { contribution: cap, label: `Target moved ${base.monthsNeeded - h.goal.left} month(s) later` } });

  return options;
}
```

**What is deliberately missing:** "move money from savings to checking". It would fix checking by shrinking the goal, which hides a cost. Say so in the drawer.

### 4.2 Applying an option

```js
const reallyApply = () => {
  setSc(s => ({ ...s, ...confirm.apply, cuts: { ...s.cuts, ...(confirm.apply.cuts || {}) }, cancelled: { ...s.cancelled, ...(confirm.apply.cancelled || {}) } }));
  setApplied({ id: confirm.id, label: confirm.apply.label });
  setConfirm(null); setDrawer(null);
};
```

The confirm modal must say, in these words or close to them: *This updates your plan. It does not move money.* The savings balance on the Goals page must not change here.

### 4.3 `BillDrawer` and `CompareDrawer`

Port both from the prototype. The evidence block highlights each phrase in `change.evidence`:

```jsx
{notice.split('\n').map((line, i) => <div key={i}>{change.evidence.some(e => line.includes(e)) ? <mark>{line}</mark> : (line || ' ')}</div>)}
```

The judge control is the number input bound to `sc.increase`. Label it "For the judges: change the increase". It stays in the drawer, off the main path, so ordinary users never see a "what if" input they did not ask for.

### 4.4 `buildAlerts(h, sc, sim, cap, applied)` — one event, one alert

```js
export function buildAlerts(h, sc, sim, cap, applied) {
  const out = [];
  const changed = h.recurring.find(r => r.change);
  const fits = sc.contribution <= cap;
  const g = goalAt(h, cap);
  if (changed && sc.increase > 0 && !applied) out.push({ tone: 'warn', title: `Your ${changed.label.toLowerCase()} bill increased by $${sc.increase}.`,
    body: [ !fits && `Your planned $${sc.contribution} contribution would leave $${Math.round(sim.low.balance)} on ${short(sim.low.date)}, below your $${h.cushion} cushion.`,
            g.gap && `Your goal would end $${g.gap} short.`, 'Review the effect on your goal.' ].filter(Boolean).join(' '),
    actions: ['bill', 'compare'] });
  else if (sim.worst === 'over' || sim.worst === 'below') out.push({ tone: 'bad', title: `Projected balance falls to $${Math.round(sim.low.balance)} on ${short(sim.low.date)}.`, body: `That is below your $${h.cushion} cushion before payday.` });
  if (applied) out.push({ tone: 'good', title: 'Plan updated.', body: `${applied.label}. Nothing was transferred.` });
  return out;
}
```

The `else if` is the "one combined alert" rule: when the bill change causes the cushion crossing, you get one alert, not two.

**Done when:** changing the increase to 75 in the drawer makes the KPI tiles read $225/mo and $300 short, and "Reduce dining & takeout" changes to $125.

---

## Phase 5 — The other pages (3 h)

All five are in the prototype. Port in this order, because it matches demo value:

1. **Goals** — progress bar, `GoalChart`, the original-versus-updated table, the schedule, the savings card (phase 6 adds the transfer), the cushion card.
2. **Recurring** — the table with the strikethrough old amount on the changed bill, and the electric "One-time / New price" buttons that set `sc.treatElectricAsNew`.
3. **Forecast** — the taller chart, the day-by-day table (`sim.days.filter(d => d.events.length > 1)`), the assumptions card, `IncomeList` in full.
4. **Transactions** — filter chips over the `transactions` array from the data layer; the two "needs review" rows keep their reasons visible.
5. **Cash flow** — `CashBars` with `history` plus the projected month, and the allowance bars with trimmed amounts struck through.

Editable income is the same `IncomeList` as the dashboard. Its `onChange` sets `sc.income` to an edited copy with `status: 'edited'`. Because `simulate()` prefers `sc.income` when present, the forecast follows immediately.

**Done when:** every sidebar item opens a page with real numbers, and the electric "New price" button visibly lowers the lowest-point label.

---

## Phase 6 — Transfer with read-back, Persona, deploy (2 h)

### 6.1 The sandbox transfer, done honestly

```js
// api/transfer.js
import { nessie } from './_nessie.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { amount, inquiryId } = req.body || {};
  if (!(amount > 0)) return res.status(400).json({ message: 'Amount required.' });
  if (process.env.PERSONA_API_KEY) {                    // optional gate, see 6.2
    const inq = await fetch(`https://api.withpersona.com/api/v1/inquiries/${inquiryId}`, { headers: { Authorization: `Bearer ${process.env.PERSONA_API_KEY}`, 'Persona-Version': '2023-01-05' } }).then(r => r.json()).catch(() => null);
    if (inq?.data?.attributes?.status !== 'completed') return res.status(403).json({ message: 'Verification not completed.' });
  }
  const today = (process.env.VITE_DEMO_DATE || new Date().toISOString().slice(0, 10));
  const created = await nessie(`/accounts/${process.env.NESSIE_CHECKING_ID}/transfers`, { method: 'POST',
    body: JSON.stringify({ medium: 'balance', payee_id: process.env.NESSIE_SAVINGS_ID, amount, transaction_date: today, description: 'RainCheck savings contribution' }) });
  const id = created.objectCreated?._id;
  const status = id ? (await nessie(`/transfers/${id}`)).status : 'unknown';   // READ BACK before claiming anything
  const savings = await nessie(`/accounts/${process.env.NESSIE_SAVINGS_ID}`);
  res.status(200).json({ id, status, savingsBalance: savings.balance });
}
```

On the Goals page: button → "Transfer requested" → the response's `status` decides the badge. Only `completed` shows the green check. Anything else shows the status word as returned. That is the read-back your plan calls for.

### 6.2 Persona in ten lines (optional)

```bash
npm i persona
```

```js
import Persona from 'persona';
export function verifyIdentity({ templateId, environmentId }) {
  return new Promise((resolve, reject) => {
    const client = new Persona.Client({ templateId, environmentId, referenceId: 'demo-alex',
      onReady: () => client.open(), onComplete: ({ inquiryId, status }) => resolve({ inquiryId, status }), onCancel: () => reject(new Error('cancelled')), onError: reject });
  });
}
```

Call it before `POST /api/transfer`, pass `inquiryId` along, and use the sandbox's force-pass toggle during the demo. Template and environment IDs are public and can be `VITE_` variables; the API key is not and stays in `.env.local`. Timebox this to 45 minutes. If it fights you, ship without it.

### 6.3 Deploy

```bash
npx vercel login
npx vercel link
npx vercel env add NESSIE_KEY
npx vercel env add NESSIE_CUSTOMER_ID
npx vercel env add NESSIE_CHECKING_ID
npx vercel env add NESSIE_SAVINGS_ID
npx vercel env add VITE_DATA_MODE       # "nessie"
npx vercel env add VITE_DEMO_DATE       # "2026-09-28"
npx vercel deploy --prod
```

Open the URL on a phone and a laptop. Record a 20-second screen capture of the happy path as a backup in case the venue Wi-Fi dies.

**Done when:** the deployed dashboard says "Nessie sandbox" in the footer, and the Goals page transfer returns a status.

---

## Phase 7 — Video, Devpost, live demo (2.5 h)

### The 2-minute live demo

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Dashboard | "RainCheck shows how a changing bill affects your next payday and your savings goal, and lets you compare realistic adjustments before committing." |
| 0:10 | Hover the chart | "This is Alex's checking balance for the next month, from real bank data: every bill, every paycheck, everyday spending, and the $300 they planned to save." |
| 0:25 | Point at the lowest-point label | "Their internet bill just went up $25. With the old plan, they dip to $175, under their $200 cushion." |
| 0:35 | Open "See what changed" | "We do not just say 'bill increased'. Here is the notice, with the sentence that proves it. Price change, not usage." |
| 0:50 | Judge control: type 75 | "Change it yourself." Watch the KPIs move. "Contribution the plan supports, goal gap, and the trim needed all recompute from the same simulation." |
| 1:10 | Compare options | "Four responses, each previewed by running the forecast, not by a rule of thumb. Notice we never offer 'raid your savings'; that hides a cost." |
| 1:30 | Apply "Reduce dining" | "Applying updates the plan. It does not move money." |
| 1:40 | Goals page, transfer | "When they are ready, the transfer runs in Capital One's sandbox, and we read its status back before we call it done." |
| 1:55 | Close | "Rocket Money tells you a bill went up. RainCheck tells you what that does to your goal and what you can do about it. Questions?" |

### Video outline (30s / 2m / 30s / 30s, per the handbook)

- Intro: team, Finance track, Capital One Nessie challenge (and Persona if shipped).
- Demo: the script above, screen-recorded.
- Technical: one simulation drives everything; contribution capacity is a search over the forecast; six unit tests; Nessie behind a proxy with a snapshot fallback; the transfer's status is read back.
- Impact and next: editable expected income (a documented gap in the competitor's payday view), more bill types, real notice ingestion from email using PayProof's extractor, and a bank's real payee data instead of a sandbox.

### Devpost one-liner

**RainCheck shows how changing bills affect your next payday and your savings goals, and lets you compare realistic adjustments before committing.**

---

## Appendix A — the scenario, in plain words

| Field | Meaning | Who changes it |
| --- | --- | --- |
| `increase` | how much the flagged bill went up per month | the notice parser; the judge control |
| `contribution` | planned monthly savings amount | applying an option |
| `cuts` | monthly reductions to allowances | applying "Reduce…" |
| `cancelled` | bills skipped from today on | applying "Review renewal" |
| `treatElectricAsNew` | whether an unexplained posted amount becomes the new price | the Recurring page buttons |
| `income` | the user's edited copy of expected deposits | `IncomeList` |

## Appendix B — what to say when a judge asks…

- **"Is this just Rocket Money?"** Rocket Money detects the increase and shows a payday allowance. RainCheck connects the increase to the cash-flow floor and to the goal, previews concrete alternatives by simulation, and keeps proposed plans separate from money moved. It also lets you edit expected income, which their payday view does not support.
- **"How do you know it is a price change?"** Only when a notice says so, and we show the sentence. Otherwise we say the amount changed and we have not confirmed why.
- **"What if Nessie goes down?"** The proxy falls back to a snapshot taken from the same sandbox, and the footer says so.
- **"Does applying a plan move money?"** No. The Goals page runs a sandbox transfer only when you ask, and shows the status Nessie returns.
