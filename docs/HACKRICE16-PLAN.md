# PayProof at HackRice 16 — the 48-hour turnaround plan

Written September 11, 2026 (Friday). Devpost deadline: **Sunday 9/13, 9:00 AM**. Live judging: **Sunday 9:30 AM–12:00 PM**, 3 minutes per judge (2 min demo + 1 min Q&A).

---

## 1. The pivot in five lines

1. **Same name, same engine, new audience.** PayProof stops being an accounts-payable workbench for "Harbor Studio" and becomes a consumer app: *"Check before you pay."* The user is a person who gets bills by email and isn't sure whether to pay: a student, a parent, a grandparent.
2. **Compare against the bank, not a typed-in vendor list.** Nessie (Capital One's mock bank API) supplies the user's real payment history: who they usually pay, how much, how often. The "Vendors" screen and all its setup disappear. That kills the cold-start problem that makes the current UI confusing.
3. **Add the money consequence.** "If you pay this today, your balance drops to $312 on Sep 24, before your next deposit." That is the Finance track's "actionable insight" and gives the demo a chart that moves.
4. **Money actually moves (mock).** "Pay" creates a Nessie bill and withdrawal, gated by a Persona human-verification step. The balance line drops on screen. Judges see a complete transaction, not a review note.
5. **Three questions, one screen.** Every check answers *Who is asking? What's different? Can you afford it?* in plain words, 18px text, one primary button. "Show me why" reveals the highlighted email evidence you already built.

**Why this over ChatGPT's "Plan B" or "Commitment Lens":** Plan B needs a constraint-solver you'd write from scratch and throws away your extraction engine. Commitment Lens drops the fraud angle that gives PayProof its impact story (IC3: BEC is the second-largest loss category; older adults lose the most). This pivot reuses about 70% of the working code, adds two pure functions and two API routes, and follows the winner pattern ChatGPT found: recognizable problem → distinctive action → visible consequence → inspectable result.

---

## 2. Fit with the handbook

| Handbook item | How PayProof fits |
| --- | --- |
| **Finance track** (pick one track) | "Turn raw financial data into personalized, actionable insight." The check reads the bill *and* the bank history, then says what to do. Differs from HR15's OwlNudge/Swipe Coach (spend-side nudges) by sitting at the moment money leaves. |
| **Capital One: Best Use of Nessie** ($250/member) | Accounts, purchases, bills, deposits, merchants are the *source of truth* for "who you usually pay" and the forecast. Pay writes a bill + withdrawal back. That is creative use of the endpoints, not a balance widget. |
| **Persona: Prove you're human** | "Anything where money moves... make one people don't mind going through." Verification appears only on Pay, never on sign-up. Sandbox has a force-pass toggle for the demo. |
| **ElevenLabs** (optional, 1 hour) | "Read this to me" button on the result. Legit accessibility for the non-tech-savvy persona, and a challenge entry. |
| **Lilie Lab AI** (Rice-only, optional) | If a teammate is Rice and you want it: a Gemini "explain this bill in plain words" call on the fictional email. Not required. |
| **Technical rigor** | Deterministic extraction with 250+ passing tests, evidence-bounded quotes, day-by-day cash projection, server-side verified Persona inquiry, snapshot fallback when Nessie is down. |
| **Originality** | Email evidence × bank history × cash forecast in one check. Nobody else at the table will combine the inbox with Nessie. |
| **UX & Design** | Three-question result card, plain language, big type, one button. Judge-editable scenario. |
| **Practicality & Impact** | Built for the people scammers target most. Works with no setup: connect the bank, paste the bill. |

---

## 3. Keep, cut, add

**Keep (reuse as-is):**
- `src/payproof/reviewFacts.js` (`extractReviewFacts`) — amounts, account endings, deadlines, references with evidence quotes.
- `src/payproof/emailText.js`, `messageText.js` — normalization and quoted-history removal.
- `src/payproof/annotations.js` + `EvidenceLens.jsx` — for "Show me why".
- `src/payproof/model.js` helpers (`domain`, `emailAddress`, `parseAmount`, `importTextRequest`).
- `src/payproof/AppTheme.jsx` (warm orange brand, light/dark), `server/http.js`, `server/security.js`, `vercel.json`, the Vite dev API plugin.
- All existing tests. They are your "technical rigor" slide.

**Cut from the hackathon build (hide, don't delete):**
- Gmail OAuth flow and Connections page. Demo runs in sample mode with paste/upload. Avoids restricted-scope trouble on a fresh deploy.
- Vendors, Activity, workspace switcher, search, filters, "Change category", "Edit saved context", "Report a problem", export.
- The three UI shells (original / calm / fusion). Build one new `/check` route with new components. Do not refactor the workbench.
- The hedging copy on every line. One footer sentence is enough: *"PayProof compares this bill with your past payments. It cannot prove who sent it."*

**Add:**
- `api/nessie/profile.js` — server proxy + 60s cache + snapshot fallback.
- `api/nessie/pay.js` — verify Persona inquiry, create bill + withdrawal, return new balance.
- `src/check/matchHistory.js` — pure: email facts × payee profile → status + plain-words differences.
- `src/check/forecast.js` — pure: balance + bills + deposits + this request → day-by-day points, lowest point, words.
- `src/check/` screens: `HomeScreen.jsx`, `ResultScreen.jsx`, `PaidScreen.jsx`, `BalanceLine.jsx`, `scenarios.js`, `usePersonaGate.js`.
- `scripts/seed-nessie.mjs` + `data/nessie-snapshot.json` + `data/household.json`.
- Optional: `api/voice/say.js` (ElevenLabs).

---

## 4. The product: three screens

### Screen 1 — Home
- Brand + one line: **Check before you pay.**
- One giant button: **Check a bill** → sheet with three choices: *Paste the email*, *Upload a file* (.txt/.eml, existing importer), *Try an example* (three scenarios).
- Below: **Recent checks**, one line each: payee · amount · status words. Nothing else.
- Tiny footer link: *Try it yourself* (judge panel: editable email text, live re-check).

### Screen 2 — Result (the whole product)
Status banner (icon + color + words, never color alone):
- ✅ **Looks like your usual bill**
- ⚠️ **Something changed. Check before you pay.**
- ❓ **We haven't seen this sender before.**

Three cards, each a question answered in one or two sentences:
1. **Who is asking?** "Northline Fabrication. You've paid them 6 times, most recently Aug 5, about $480 each time."
2. **What's different?** "Your past payments went to an account ending 1098. This email asks for 4419." / "Their emails usually come from northline.example. This one came from northline-pay.example." Then *Show me why* → the email excerpt with the changed characters highlighted (EvidenceLens).
3. **Can you afford it?** "You can pay this, but your balance would drop to $312 on Sep 24, before your next deposit." + the balance line. A small slider or the judge panel lets someone change the amount and watch the line move.

Buttons depend on status:
- usual → **Pay from my usual account** (primary) · *Hold for now*
- changed → **Call Northline to check** (primary, `tel:` link from the household contact) · *Pay anyway* (text button)
- unknown → **Hold and ask someone** (primary) · *Pay anyway*

Optional: **Read this to me** (ElevenLabs) reads the three answers.

### Screen 3 — Paid / Held
- Paid: "Paid $480 to Northline Fabrication. Balance now $1,660. Next: Electric, $162 on Sep 18." **Done.**
- Held: "Saved. Share a plain summary with someone you trust." **Copy summary** · **Read it aloud**.

### UI rules for non-tech-savvy users (apply everywhere)
- One question per screen, one primary button. Everything else is a text link.
- Body text ≥ 18px, headings 28–36px, tap targets ≥ 48px.
- Plain words: "bill" not "payment request"; "who you usually pay" not "vendor record"; "account ending in 4419" not "requested account".
- Status is icon + color + words. Never rely on color alone.
- Progressive disclosure: never show the raw email first. "Show me why" opens it.
- No settings, no workspace, no filters, no search on the demo path.
- Every unknown is a sentence: "We haven't seen this sender in your bank history."
- No modal confirm dialogs. Persona *is* the confirmation on Pay.

---

## 5. Architecture and stack

```
Browser (React 19 + Vite + MUI 9, existing theme)
  /check
   ├─ HomeScreen ── paste / upload / example ──► checkRequest(email, profile)   (pure, tested)
   ├─ ResultScreen ── projectBalance(profile, request)                          (pure, tested)
   │     ├─ EvidenceLens (existing)  "Show me why"
   │     ├─ BalanceLine (plain SVG)
   │     └─ usePersonaGate ── Persona web SDK (sandbox)
   └─ PaidScreen

Vercel Node functions (existing pattern: server/http.js)
   GET  /api/nessie/profile ── Nessie (HTTP) ──► payees, balance, upcoming bills, deposits
                             └─ fallback: data/nessie-snapshot.json
   POST /api/nessie/pay     ── verify Persona inquiry ──► POST bill + withdrawal ──► new balance
   POST /api/voice/say      ── ElevenLabs TTS (optional)
```

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 19 + Vite + MUI 9 (already installed) | Zero migration. Override the theme for bigger type. Don't switch to Tailwind mid-hackathon. |
| Charts | Hand-rolled SVG (30 lines) | No new dependency, full control, animates with CSS. |
| Bank data | Nessie via server proxy (HTTPS) | Keeps the key server-side, caches for 60s, and falls back to the snapshot if the shared sandbox is slow or down. |
| Identity | `persona` npm package, sandbox | Ten lines. Template and environment IDs are public, the API key is not. |
| Voice | ElevenLabs REST via server function | Optional. One endpoint. |
| Hosting | Vercel (existing project or a new one) | Same `vercel.json`. Demo in sample mode: no OAuth, no database needed. |
| Tests | `node --test` (existing) | Add tests for the two pure functions. That's the rigor story. |

New dependency: `npm i persona`. That's it.

Environment (server-only, in `.env.local` and Vercel): `NESSIE_KEY`, `NESSIE_ACCOUNT_ID`, `PERSONA_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
Public (safe with `VITE_`): `VITE_PERSONA_TEMPLATE_ID`, `VITE_PERSONA_ENV_ID`.

---

## 6. Nessie: seed it Friday night, snapshot it, never depend on it live

**Verified September 11, 2026 from this machine: the API is up, over HTTPS only.** `http://api.nessieisreal.com` (the URL in the old docs, every official SDK, and most search results) times out, and the older `api.reimaginebanking.com` no longer resolves. Use `https://api.nessieisreal.com`. The enterprise endpoints already show bills and accounts other HackRice teams created today, so the service is live.
- Base URL `https://api.nessieisreal.com`, key as `?key=YOUR_KEY`. Get the key by signing in at https://nessieisreal.com with GitHub (the site is a JavaScript app; the key is on your profile page).
- Keys scope data: `GET /customers?key=...` returns only customers created with that key. An unknown key returns `[]`, not an error, so a typo looks like "no data" rather than "bad key".
- `GET /enterprise/customers`, `/enterprise/accounts`, `/enterprise/bills`, `/enterprise/merchants` return everyone's data across all keys. Never put anything real in Nessie, and don't build on enterprise reads.
- Endpoint shapes below are from memory; confirm field names against the documentation page once you're signed in.
- `POST /customers` → `{ first_name, last_name, address:{street_number, street_name, city, state, zip} }`
- `POST /customers/{id}/accounts` → `{ type:"Checking"|"Savings"|"Credit Card", nickname, rewards, balance }`
- `GET /accounts/{id}` · `GET /accounts/{id}/purchases` · `/bills` · `/deposits` · `/withdrawals` · `GET /merchants`
- `POST /merchants` → `{ name, category, address, geocode:{lat,lng} }`
- `POST /accounts/{id}/purchases` → `{ merchant_id, medium:"balance", purchase_date, amount, status, description }`
- `POST /accounts/{id}/bills` → `{ status:"pending"|"recurring"|"completed", payee, nickname, payment_date, recurring_date, payment_amount }`
- `POST /accounts/{id}/deposits` / `/withdrawals` → `{ medium:"balance", transaction_date, status, amount, description }`
- Responses to POST look like `{ code:201, message:"...", objectCreated:{ _id, ... } }`.

Two honest workarounds:
- Nessie has no "destination account" for a merchant. Stash it in the purchase `description` ("acct ending 1098") and parse it. Say so in the video if asked.
- Check whether a purchase/withdrawal actually changes `balance` in your sandbox. If it doesn't, keep the paid amount in app state for the chart.

### `scripts/seed-nessie.mjs`

```js
// NESSIE_KEY=... node scripts/seed-nessie.mjs
import { writeFile } from 'node:fs/promises';

const BASE = 'https://api.nessieisreal.com';
const KEY = process.env.NESSIE_KEY;
const call = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}?key=${KEY}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return res.json();
};

const customer = await call('POST', '/customers', {
  first_name: 'Alex', last_name: 'Rivera',
  address: { street_number: '6100', street_name: 'Main St', city: 'Houston', state: 'TX', zip: '77005' },
});
const customerId = customer.objectCreated._id;

const account = await call('POST', `/customers/${customerId}/accounts`, {
  type: 'Checking', nickname: 'Everyday checking', rewards: 0, balance: 2140,
});
const accountId = account.objectCreated._id;

const northline = await call('POST', '/merchants', {
  name: 'Northline Fabrication', category: 'Home services',
  address: { street_number: '12', street_name: 'Harbor Rd', city: 'Houston', state: 'TX', zip: '77002' },
  geocode: { lat: 29.76, lng: -95.36 },
});
const northlineId = northline.objectCreated._id;

// Six past payments in a tight range → "you usually pay them about $480"
const months = ['2026-03-05', '2026-04-05', '2026-05-05', '2026-06-05', '2026-07-05', '2026-08-05'];
for (const [i, date] of months.entries()) {
  await call('POST', `/accounts/${accountId}/purchases`, {
    merchant_id: northlineId, medium: 'balance', purchase_date: date,
    amount: 480 + (i % 2) * 15, status: 'completed',
    description: 'Northline monthly service · acct ending 1098',
  });
}
await call('POST', `/accounts/${accountId}/bills`, {
  status: 'pending', payee: 'Reliant Energy', nickname: 'Electric',
  payment_date: '2026-09-18', recurring_date: 18, payment_amount: 162,
});
await call('POST', `/accounts/${accountId}/bills`, {
  status: 'pending', payee: 'Comcast', nickname: 'Internet',
  payment_date: '2026-09-22', recurring_date: 22, payment_amount: 89,
});
// If Nessie rejects a future-dated deposit, keep next payday in data/household.json instead.
await call('POST', `/accounts/${accountId}/deposits`, {
  medium: 'balance', transaction_date: '2026-09-26', status: 'pending', amount: 1850, description: 'Payroll',
});

const snapshot = {
  customerId, accountId,
  account: await call('GET', `/accounts/${accountId}`),
  purchases: await call('GET', `/accounts/${accountId}/purchases`),
  bills: await call('GET', `/accounts/${accountId}/bills`),
  deposits: await call('GET', `/accounts/${accountId}/deposits`),
  merchants: await call('GET', '/merchants'),
};
await writeFile('data/nessie-snapshot.json', JSON.stringify(snapshot, null, 2));
console.log('Seeded. Put this in .env.local:', `NESSIE_ACCOUNT_ID=${accountId}`);
```

### `data/household.json` (things a bank doesn't know)

```json
{
  "cushion": 200,
  "nextPayday": { "date": "2026-09-26", "amount": 1850 },
  "contacts": [
    { "name": "Northline Fabrication", "domain": "northline.example", "phone": "(713) 555-0148", "person": "Jamie Torres" }
  ]
}
```

---

## 7. Code examples

### `api/nessie/profile.js`

```js
import { json, method } from '../../server/http.js';
import snapshot from '../../data/nessie-snapshot.json' with { type: 'json' };
import household from '../../data/household.json' with { type: 'json' };

const BASE = 'https://api.nessieisreal.com';
let cache = { at: 0, value: null };

async function nessie(path) {
  const res = await fetch(`${BASE}${path}?key=${process.env.NESSIE_KEY}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Nessie ${res.status}`);
  return res.json();
}

async function load() {
  if (cache.value && Date.now() - cache.at < 60_000) return cache.value;
  const id = process.env.NESSIE_ACCOUNT_ID;
  try {
    const [account, purchases, bills, deposits, merchants] = await Promise.all([
      nessie(`/accounts/${id}`), nessie(`/accounts/${id}/purchases`), nessie(`/accounts/${id}/bills`),
      nessie(`/accounts/${id}/deposits`), nessie('/merchants'),
    ]);
    cache = { at: Date.now(), value: { source: 'nessie', account, purchases, bills, deposits, merchants } };
  } catch {
    // Demo survival: Nessie is a shared sandbox that can be slow or down during judging. Serve the seeded snapshot instead.
    cache = { at: Date.now(), value: { source: 'snapshot', ...snapshot } };
  }
  return cache.value;
}

export function buildPayees({ purchases, bills, merchants }, contacts = []) {
  const merchantName = new Map(merchants.map(m => [m._id, m.name]));
  const payees = new Map();
  const bump = (name, amount, date, description = '') => {
    const p = payees.get(name) || { name, count: 0, amounts: [], lastPaid: null, accountEnding: null };
    p.count += 1; p.amounts.push(amount);
    if (!p.lastPaid || date > p.lastPaid) p.lastPaid = date;
    const ending = /ending\s+(\d{4})/i.exec(description);
    if (ending) p.accountEnding = ending[1];
    payees.set(name, p);
  };
  for (const x of purchases) bump(merchantName.get(x.merchant_id) || 'Unknown merchant', x.amount, x.purchase_date, x.description);
  for (const b of bills) bump(b.payee, b.payment_amount, b.payment_date, b.nickname);
  return [...payees.values()].map(p => {
    const contact = contacts.find(c => c.name === p.name) || {};
    return {
      ...p, ...contact,
      typicalAmount: p.amounts.reduce((a, b) => a + b, 0) / p.amounts.length,
      maxAmount: Math.max(...p.amounts),
    };
  });
}

export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  const data = await load();
  const pendingDeposits = data.deposits.filter(d => d.status === 'pending');
  json(res, 200, {
    source: data.source,
    balance: data.account.balance,
    cushion: household.cushion,
    payees: buildPayees(data, household.contacts),
    upcomingBills: data.bills.filter(b => b.status === 'pending' || b.status === 'recurring'),
    expectedDeposits: pendingDeposits.length
      ? pendingDeposits
      : [{ transaction_date: household.nextPayday.date, amount: household.nextPayday.amount, description: 'Next payday' }],
  });
}
```

### `src/check/matchHistory.js` (pure, tested)

```js
import { extractReviewFacts } from '../payproof/reviewFacts.js';
import { domain } from '../payproof/model.js';

const normalize = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const toNumber = s => Number(String(s).replace(/[^0-9.]/g, '')) || 0;

function findPayee(email, payees) {
  const hay = normalize(`${email.sender} ${email.subject} ${email.body}`);
  return payees.find(p => hay.includes(normalize(p.name))) || null;
}

export function checkRequest(email, profile) {
  const facts = extractReviewFacts(email);
  const fact = id => facts.find(f => f.id === id);
  const requested = {
    amount: toNumber(fact('amount')?.value),
    account: fact('account')?.value || '',
    sender: email.sender,
  };
  const payee = findPayee(email, profile.payees);
  if (!payee) return { status: 'unknown', payee: null, requested, facts, differences: [] };

  const differences = [];
  if (payee.accountEnding && requested.account && payee.accountEnding !== requested.account)
    differences.push({ field: 'account', known: payee.accountEnding, requested: requested.account,
      say: `Your past payments went to an account ending ${payee.accountEnding}. This email asks for ${requested.account}.` });
  if (payee.domain && domain(email.sender) && payee.domain !== domain(email.sender))
    differences.push({ field: 'sender', known: payee.domain, requested: domain(email.sender),
      say: `Their emails usually come from ${payee.domain}. This one came from ${domain(email.sender)}.` });
  if (requested.amount && requested.amount > payee.maxAmount * 1.5)
    differences.push({ field: 'amount', known: payee.typicalAmount, requested: requested.amount,
      say: `You usually pay them about $${Math.round(payee.typicalAmount)}. This asks for $${requested.amount}.` });

  return { status: differences.length ? 'changed' : 'usual', payee, requested, facts, differences };
}
```

`src/check/matchHistory.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRequest } from './matchHistory.js';

const profile = { payees: [{ name: 'Northline Fabrication', accountEnding: '1098', domain: 'northline.example', typicalAmount: 487, maxAmount: 495, count: 6 }] };

test('a changed account and sender domain are both reported', () => {
  const email = { sender: 'billing@northline-pay.example', subject: 'Updated payment details',
    body: 'Hi Alex, our banking details have changed. Total due: $480. Please send to the new account ending 4419.' };
  const r = checkRequest(email, profile);
  assert.equal(r.status, 'changed');
  assert.deepEqual(r.differences.map(d => d.field), ['account', 'sender']);
});

test('the usual bill is usual', () => {
  const email = { sender: 'billing@northline.example', subject: 'Invoice INV-8842', body: 'Total due: $480. Please use our usual account ending 1098.' };
  assert.equal(checkRequest(email, profile).status, 'usual');
});

test('an unknown sender is unknown, not dangerous', () => {
  const email = { sender: 'x@quickship.example', subject: 'Overdue', body: 'Pay $1,250 to account ending 5531.' };
  assert.equal(checkRequest(email, profile).status, 'unknown');
});
```

### `src/check/forecast.js` (pure, tested)

```js
const iso = d => d.toISOString().slice(0, 10);
const pretty = s => new Date(`${s}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function projectBalance({ balance, upcomingBills = [], expectedDeposits = [], request = null, days = 21, today = new Date() }) {
  const start = new Date(today); start.setHours(0, 0, 0, 0);
  const events = [
    ...upcomingBills.map(b => ({ date: b.payment_date, delta: -b.payment_amount, label: b.payee })),
    ...expectedDeposits.map(d => ({ date: d.transaction_date, delta: +d.amount, label: d.description || 'Deposit' })),
    ...(request ? [{ date: request.date || iso(start), delta: -request.amount, label: request.payee }] : []),
  ];
  const points = []; let running = balance;
  for (let i = 0; i <= days; i++) {
    const day = new Date(start); day.setDate(start.getDate() + i);
    const key = iso(day);
    for (const e of events) if (e.date === key) running += e.delta;
    points.push({ date: key, balance: Math.round(running * 100) / 100 });
  }
  const lowest = points.reduce((a, b) => (b.balance < a.balance ? b : a));
  return { points, lowest, events };
}

export function affordabilityWords({ lowest }, cushion = 200) {
  if (lowest.balance < 0) return { tone: 'stop', text: `If you pay this today, your account would go below zero on ${pretty(lowest.date)}.` };
  if (lowest.balance < cushion) return { tone: 'warn', text: `You can pay this, but your balance would drop to $${lowest.balance} on ${pretty(lowest.date)}, before your next deposit.` };
  return { tone: 'go', text: `You can pay this. Your balance stays above $${cushion} until your next deposit.` };
}
```

### `src/check/theme.js` (readability overrides on the existing brand theme)

```js
import { createTheme } from '@mui/material/styles';
import { brandTheme } from '../payproof/AppTheme.jsx'; // whatever your existing theme export is called

export const checkTheme = createTheme(brandTheme, {
  typography: {
    fontSize: 16,
    h4: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.25 },
    body1: { fontSize: '1.125rem', lineHeight: 1.55 },
    button: { fontSize: '1.05rem', fontWeight: 600, textTransform: 'none' },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 52, paddingInline: 22 } } },
    MuiCard: { styleOverrides: { root: { padding: 4 } } },
  },
});
```

### `src/check/ResultScreen.jsx`

```jsx
import { useState } from 'react';
import { Box, Button, Card, CardContent, Collapse, Stack, Typography } from '@mui/material';
import BalanceLine from './BalanceLine.jsx';
import EvidenceExcerpt from './EvidenceExcerpt.jsx'; // thin wrapper around EvidenceLens / facts[].evidence

const STATUS = {
  usual:   { color: 'success.main', icon: '✅', title: 'Looks like your usual bill' },
  changed: { color: 'warning.main', icon: '⚠️', title: 'Something changed. Check before you pay.' },
  unknown: { color: 'info.main',    icon: '❓', title: "We haven't seen this sender before." },
};

export default function ResultScreen({ result, forecast, cushion, onPay, onHold, onSpeak }) {
  const [why, setWhy] = useState(false);
  const s = STATUS[result.status];
  const { payee } = result;

  return (
    <Stack spacing={3} sx={{ maxWidth: 640, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Box sx={{ borderLeft: 8, borderColor: s.color, pl: 2, py: 1 }}>
        <Typography variant="h4" component="h1">{s.icon} {s.title}</Typography>
      </Box>

      <Question title="Who is asking?">
        {payee
          ? `${payee.name}. You've paid them ${payee.count} times, most recently ${payee.lastPaid}, about $${Math.round(payee.typicalAmount)} each time.`
          : 'This sender is not in your bank history.'}
      </Question>

      <Question title="What's different?">
        {result.differences.length
          ? result.differences.map(d => <Typography key={d.field} sx={{ mb: 1 }}>{d.say}</Typography>)
          : 'Nothing we can see. The sender, account and amount match your past payments.'}
        <Button variant="text" onClick={() => setWhy(v => !v)} aria-expanded={why}>{why ? 'Hide' : 'Show me why'}</Button>
        <Collapse in={why}><EvidenceExcerpt facts={result.facts} differences={result.differences} /></Collapse>
      </Question>

      <Question title="Can you afford it?">
        <Typography sx={{ mb: 1 }}>{forecast.words.text}</Typography>
        <BalanceLine points={forecast.points} lowest={forecast.lowest} cushion={cushion} />
      </Question>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {result.status === 'changed' && payee?.phone ? (
          <>
            <Button size="large" variant="contained" href={`tel:${payee.phone.replace(/\D/g, '')}`} sx={{ flex: 1 }}>
              Call {payee.name} to check
            </Button>
            <Button size="large" variant="text" onClick={onPay}>Pay anyway</Button>
          </>
        ) : result.status === 'usual' ? (
          <>
            <Button size="large" variant="contained" onClick={onPay} sx={{ flex: 1 }}>Pay from my usual account</Button>
            <Button size="large" variant="outlined" onClick={onHold}>Hold for now</Button>
          </>
        ) : (
          <>
            <Button size="large" variant="contained" onClick={onHold} sx={{ flex: 1 }}>Hold and ask someone</Button>
            <Button size="large" variant="text" onClick={onPay}>Pay anyway</Button>
          </>
        )}
      </Stack>

      {onSpeak && <Button variant="text" onClick={onSpeak}>🔊 Read this to me</Button>}
      <Typography variant="body2" color="text.secondary">
        PayProof compares this bill with your past payments. It cannot prove who sent it.
      </Typography>
    </Stack>
  );
}

function Question({ title, children }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="overline" color="text.secondary" component="h2">{title}</Typography>
        <Typography component="div">{children}</Typography>
      </CardContent>
    </Card>
  );
}
```

### `src/check/BalanceLine.jsx` (no chart library)

```jsx
export default function BalanceLine({ points, lowest, cushion = 200, width = 560, height = 150 }) {
  const values = points.map(p => p.balance);
  const min = Math.min(0, ...values), max = Math.max(cushion, ...values);
  const x = i => 20 + (i / (points.length - 1)) * (width - 40);
  const y = v => height - 24 - ((v - min) / (max - min || 1)) * (height - 48);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.balance)}`).join(' ');
  const li = points.indexOf(lowest);
  const tone = lowest.balance < 0 ? '#dc2626' : lowest.balance < cushion ? '#d97706' : '#16a34a';
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img"
         aria-label={`Balance for the next ${points.length - 1} days. Lowest point $${lowest.balance} on ${lowest.date}.`}>
      <line x1="20" x2={width - 20} y1={y(cushion)} y2={y(cushion)} stroke="currentColor" strokeDasharray="4 4" opacity="0.35" />
      <text x={width - 20} y={y(cushion) - 4} textAnchor="end" fontSize="12" opacity="0.6">your ${cushion} cushion</text>
      <line x1="20" x2={width - 20} y1={y(0)} y2={y(0)} stroke="currentColor" opacity="0.5" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"
            style={{ transition: 'd 400ms ease' }} />
      <circle cx={x(li)} cy={y(lowest.balance)} r="7" fill={tone} />
      <text x={x(li)} y={y(lowest.balance) - 12} textAnchor="middle" fontSize="14" fontWeight="600">
        ${lowest.balance} on {lowest.date.slice(5).replace('-', '/')}
      </text>
    </svg>
  );
}
```

### `src/check/usePersonaGate.js`

```js
import { useCallback, useRef } from 'react';
import Persona from 'persona';

// Returns verify(): Promise<{ inquiryId, status }>. Opens the Persona widget; sandbox has a force-pass toggle.
export function usePersonaGate({ templateId, environmentId, referenceId }) {
  const ref = useRef(null);
  return useCallback(() => new Promise((resolve, reject) => {
    ref.current?.destroy?.();
    ref.current = new Persona.Client({
      templateId, environmentId, referenceId,
      onReady: () => ref.current.open(),
      onComplete: ({ inquiryId, status }) => resolve({ inquiryId, status }),
      onCancel: () => reject(new Error('cancelled')),
      onError: reject,
    });
  }), [templateId, environmentId, referenceId]);
}
```

Wiring in the check page:

```jsx
const verify = usePersonaGate({
  templateId: import.meta.env.VITE_PERSONA_TEMPLATE_ID,
  environmentId: import.meta.env.VITE_PERSONA_ENV_ID,
  referenceId: 'demo-alex',
});

async function onPay() {
  let inquiry;
  try { inquiry = await verify(); } catch { return; }              // cancelled: stay on the result
  if (inquiry.status !== 'completed') return setNotice('Verification was not completed.');
  const paid = await fetch('/api/nessie/pay', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inquiryId: inquiry.inquiryId, payee: result.payee?.name || 'Unknown', amount: result.requested.amount }),
  }).then(r => r.json());
  setProfile(p => ({ ...p, balance: paid.balance }));               // chart drops → visible consequence
  setScreen('paid');
}
```

### `api/nessie/pay.js`

```js
import { json, method } from '../../server/http.js';
const BASE = 'https://api.nessieisreal.com';
const post = (path, body) => fetch(`${BASE}${path}?key=${process.env.NESSIE_KEY}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json());

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const { inquiryId, payee, amount } = req.body || {};   // reuse server/security.js JSON + Origin checks if you like
  if (!inquiryId || !payee || !(amount > 0)) return json(res, 400, { message: 'Verification, payee and amount are required.' });

  // Ten minutes well spent: confirm the inquiry server-side so the gate can't be skipped from devtools.
  const inquiry = await fetch(`https://api.withpersona.com/api/v1/inquiries/${inquiryId}`, {
    headers: { Authorization: `Bearer ${process.env.PERSONA_API_KEY}`, 'Persona-Version': '2023-01-05' },
  }).then(r => r.json()).catch(() => null);
  if (inquiry?.data?.attributes?.status !== 'completed') return json(res, 403, { message: 'Verification not completed.' });

  const id = process.env.NESSIE_ACCOUNT_ID;
  const today = new Date().toISOString().slice(0, 10);
  const bill = await post(`/accounts/${id}/bills`, { status: 'completed', payee, nickname: `PayProof · ${payee}`, payment_date: today, payment_amount: amount });
  await post(`/accounts/${id}/withdrawals`, { medium: 'balance', transaction_date: today, status: 'completed', amount, description: `Paid ${payee} via PayProof` });
  const account = await fetch(`${BASE}/accounts/${id}?key=${process.env.NESSIE_KEY}`).then(r => r.json());
  json(res, 200, { billId: bill.objectCreated?._id, balance: account.balance });
}
```

### `api/voice/say.js` (optional ElevenLabs)

```js
import { json, method } from '../../server/http.js';
export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const { text } = req.body || {};
  if (!text || text.length > 600) return json(res, 400, { message: 'Text is required (max 600 characters).' });
  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!upstream.ok) return json(res, 502, { message: 'Voice service unavailable.' });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(Buffer.from(await upstream.arrayBuffer()));
}
```

Client: build the sentence from the three answers, then

```js
const blob = await (await fetch('/api/voice/say', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })).blob();
new Audio(URL.createObjectURL(blob)).play();
```

### `src/check/scenarios.js` (the judge panel)

```js
export const SCENARIOS = [
  { id: 'usual', label: 'A normal bill',
    email: { sender: 'billing@northline.example', subject: 'Invoice INV-8842',
      body: 'Hi Alex, your monthly service invoice is ready. Total due: $480. Please use our usual account ending 1098.' } },
  { id: 'changed', label: 'A bill with new bank details',
    email: { sender: 'billing@northline-pay.example', subject: 'Updated payment details — INV-8841',
      body: 'Hi Alex, our banking details have changed. Total due: $480. Please send this to the new account ending 4419 today.' } },
  { id: 'unknown', label: 'Someone you have never paid',
    email: { sender: 'accounts@quickship-invoices.example', subject: 'Overdue invoice',
      body: 'Your account is overdue. Pay $1,250 to account ending 5531 within 24 hours to avoid collection.' } },
];
```

Judge panel = a textarea bound to `email.body` plus a sender field, re-running `checkRequest` on change (debounce 300 ms). The moment a judge edits "4419" back to "1098" and the banner flips to green is the demo's best ten seconds. Non-tech-savvy users never see this panel; it's behind the *Try it yourself* footer link.

---

## 8. 48-hour schedule

Assumes 1–2 builders. Lanes A and B can run in parallel if you have two people.

**Friday night (4 h)**
- Decide. Freeze this scope. Tell teammates: nothing outside `/check`, `api/nessie`, `src/check`.
- Get keys: Nessie (GitHub sign-in at nessieisreal.com), Persona sandbox (template + env IDs, API key), ElevenLabs via the Discord coupon bot.
- Lane A: run `seed-nessie.mjs`, commit `nessie-snapshot.json`, write `household.json`.
- Lane B: `matchHistory.js` + `forecast.js` + tests. Run `node --test src/check/*.test.js` green.

**Saturday morning (4 h)**
- Lane A: `api/nessie/profile.js` with snapshot fallback; hit it from the Vite dev API plugin.
- Lane B: theme overrides + `HomeScreen`, `ResultScreen`, `BalanceLine` on fake data. Check at 390px.

**Saturday afternoon (4 h)**
- Wire profile → result. "Show me why" using `facts[].evidence` quotes and the existing EvidenceLens highlight for changed characters.
- `scenarios.js` + the judge panel.
- Skip the 3:30 PM Google AI Studio workshop unless you're doing the Lilie Lab entry.

**Saturday evening (4 h)**
- `usePersonaGate` + `api/nessie/pay.js` → `PaidScreen`. Balance line animates down.
- Hold flow: copy summary. Optional: ElevenLabs button (1 h, only if everything above is done).
- Deploy to Vercel. Set env vars. Test the deployed URL on a phone.

**Saturday late (2 h)**
- Empty/error states in plain words. Kill console errors. Record a 20-second backup screen capture of the happy path in case Wi-Fi dies during judging.

**Sunday 6:00–8:30 AM**
- Record the 3–4 minute video (outline below). Write the Devpost page. Submit by **9:00 AM**. Do not touch code after 8:30.

**Sunday 9:30–12:00**
- Live judging, 3–4 rounds. Run the 2-minute script below. Have the deployed URL open on a laptop and a phone.

---

## 9. The 2-minute live demo script

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | Home: "Check before you pay." | "Scammers send fake bills. PayProof checks a bill against your real bank history before you pay." |
| 0:10 | Try an example → *A bill with new bank details* | "Here's a bill from a contractor Alex has paid six times." |
| 0:20 | Result: ⚠️ Something changed | "Three questions, plain English. Who's asking: Northline, six payments, about $480. What's different: the account changed from 1098 to 4419, and the sender's address changed." |
| 0:45 | Show me why | "Every claim points at the exact words in the email. Here's the extra '-pay' in the domain." |
| 1:00 | Can you afford it + line | "And here's what paying does to Alex's balance before payday." |
| 1:15 | Judge panel: edit 4419 → 1098, sender back to northline.example | "Change it yourself. Green. Now it's the usual bill." *(This is the moment. Let the judge type.)* |
| 1:30 | Pay → Persona (force pass) → Paid | "Pay requires proving you're a person. Then real mock money moves through Capital One's Nessie, and the balance drops." |
| 1:50 | Paid screen | "Built for the people scammers target most: anyone who pays bills by email. Questions?" |

Video outline (handbook: 30s intro · 2 min demo · 30s technical · 30s impact):
- Intro: name, team, **Finance track**, challenges: Nessie, Persona, (ElevenLabs).
- Demo: the script above, screen-recorded.
- Technical: deterministic extraction with evidence-bounded quotes and 250+ tests; Nessie as the payee source of truth with snapshot fallback; server-verified Persona inquiry; day-by-day cash projection.
- Impact: IC3 2025 numbers (phishing/spoofing most complaints; BEC about $3B in losses). Future: connect Gmail (already built, hidden), attachments, trusted-contact sharing, a bank's real payee data instead of Nessie.

Devpost one-liner: **PayProof checks a bill against your real payment history and cash flow before you pay, then moves the money only after you prove you're you.**

---

## 10. Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| Nessie is down or slow during judging | `profile.js` already serves the snapshot. Say "cached bank data" if asked. |
| Nessie balance doesn't move after a withdrawal | Keep paid amount in app state; chart still drops. |
| Persona template setup eats time | Timebox to 45 min. If it fails, show a plain "Confirm it's you" screen and drop the Persona challenge entry. Don't let it block Pay. |
| Wi-Fi dies at the table | 20-second backup screen recording on the laptop. |
| Scope creep into the old workbench | Rule: only `src/check/`, `api/nessie/`, `api/voice/`, `data/`, `scripts/seed-nessie.mjs` change. |
| Copy drifts back into hedging | One footer sentence per screen. Read every string aloud; if a grandparent wouldn't say it, rewrite it. |
| Gmail OAuth questions from judges | "It's built and tested; hidden for the demo because Google restricted-scope review takes weeks." |

## 11. Stretch, only if everything above works by Saturday 10 PM

1. **Read this to me** (ElevenLabs) — 1 hour, challenge entry, accessibility story.
2. **Share with someone I trust** — generate a plain summary + QR code to the result (read-only). No email sending.
3. **Photo of a paper bill** — Gemini vision on the fictional bill → same `checkRequest`. Only if a Rice teammate wants the Lilie Lab entry.
4. **What-if slider** on the amount if the judge panel textarea feels too "developer".

Not doing: BLS/inflation data, budgets, subscriptions, meal planning, multi-agent anything. They dilute the one interaction that wins.
