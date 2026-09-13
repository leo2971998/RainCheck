<<<<<<< Updated upstream:src/raincheck/data/household.sample.js
<<<<<<< Updated upstream
export const household = { today: "2026-09-28", windowDays: 34, ...{
  checking: 1260, savings: 800, cushion: 200,
  income: [
    { id: 'p1', label: 'Paycheck · Rice Coffee Co', date: '2026-10-02', amount: 1700, status: 'confirmed' },
    { id: 'p2', label: 'Paycheck · Rice Coffee Co', date: '2026-10-16', amount: 1700, status: 'estimated' },
    { id: 'p3', label: 'Paycheck · Rice Coffee Co', date: '2026-10-30', amount: 1700, status: 'estimated' },
  ],
  recurring: [
    { id: 'rent', label: 'Rent · Harbor Lofts', amount: 1150, day: 5, freq: 'Monthly' },
    { id: 'internet', label: 'Internet · Northline', amount: 65, day: 1, freq: 'Monthly', change: { to: 90, effective: '2026-10-01', why: 'Promotional credit ended', source: 'notice' } },
    { id: 'streaming', label: 'Streaming · Plexi', amount: 30, day: 3, freq: 'Monthly', cancellable: true },
    { id: 'electric', label: 'Electric · Reliant', amount: 110, day: 6, freq: 'Monthly', lastPosted: 128, unexplained: true },
    { id: 'car', label: 'Car insurance · Geico', amount: 120, day: 10, freq: 'Monthly' },
    { id: 'phone', label: 'Phone · Mint', amount: 45, day: 12, freq: 'Monthly' },
    { id: 'gym', label: 'Gym · Fit24', amount: 40, day: 15, freq: 'Monthly', renews: '2026-10-15', cancellable: true },
  ],
  allowances: [
    { id: 'groceries', label: 'Groceries', monthly: 700 }, { id: 'takeout', label: 'Dining & takeout', monthly: 180 }, { id: 'rides', label: 'Rides & transit', monthly: 60 },
    { id: 'household', label: 'Household', monthly: 260 }, { id: 'fun', label: 'Fun & other', monthly: 300 },
  ],
  goal: { label: 'Emergency fund', target: 2000, saved: 800, left: 4, planned: 300, targetLabel: 'January 2027', months: ['Oct 2', 'Nov 2', 'Dec 2', 'Jan 4'] },
  history: [{ m: 'Jul', inc: 3400, out: 3080 }, { m: 'Aug', inc: 3400, out: 3140 }, { m: 'Sep', inc: 3400, out: 3095 }],
} };
export const notice = `From: Northline Internet <billing@northline.example>
Subject: Your October bill

Hi Alex,

Your Internet 300 plan will renew at $90.00 starting with your October 1 bill.
Your 12-month promotional credit of $25.00 ended on September 30.
Your speed and service are unchanged.

Questions? Visit support.northline.example or call the number on your bill.`;
export const transactions = [
  { d: 'Sep 26', what: 'Kroger', amt: -84.12, cat: 'Groceries', k: 'ev' }, { d: 'Sep 25', what: 'Transfer to Savings', amt: -300, cat: 'Transfer', k: 'tr', note: 'Your own savings account. Not counted as spending.' },
  { d: 'Sep 24', what: 'Uber', amt: -18.4, cat: 'Rides & transit', k: 'ev', note: '4th ride this month. Not treated as a subscription.' }, { d: 'Sep 22', what: 'Amazon', amt: -48.3, cat: 'Household', k: 'ev', review: 'Matches the receipt you forwarded. Counted once.' },
  { d: 'Sep 18', what: 'Paycheck · Rice Coffee Co', amt: 1700, cat: 'Income', k: 'in' }, { d: 'Sep 15', what: 'Fit24', amt: -40, cat: 'Gym', k: 'rec' },
  { d: 'Sep 12', what: 'Mint Mobile', amt: -45, cat: 'Phone', k: 'rec' }, { d: 'Sep 10', what: 'Geico', amt: -120, cat: 'Car insurance', k: 'rec' },
  { d: 'Sep 8', what: 'Venmo · Sam R.', amt: 60, cat: 'Transfer', k: 'tr', review: 'Money back from a friend, or income?' }, { d: 'Sep 6', what: 'Reliant Energy', amt: -128, cat: 'Electric', k: 'rec', note: 'Higher than usual ($110). Not confirmed why.' },
  { d: 'Sep 5', what: 'Harbor Lofts', amt: -1150, cat: 'Rent', k: 'rec' }, { d: 'Sep 4', what: 'Paycheck · Rice Coffee Co', amt: 1700, cat: 'Income', k: 'in' }, { d: 'Sep 3', what: 'Plexi', amt: -30, cat: 'Streaming', k: 'rec' },
];

=======
// GENERATED from data/nessie-snapshot.json — do not edit by hand.
// Regenerate with:  node scripts/build-sample.mjs
//
// Sample mode and live mode go through the same builder, so ids, categories and shapes match.
export const household = {
  "today": "2026-09-28",
  "windowDays": 34,
  "cushion": 200,
  "checking": 1260,
  "savings": 800,
  "accountIds": {
    "checking": "c9f79f65-2964-4332-97dc-85a12c108609",
    "savings": "a223b739-eb6c-4847-9e12-bdadee9def04"
  },
  "income": [
    {
      "id": "p1",
      "label": "Paycheck Rice Coffee Co",
      "date": "2026-10-02",
      "amount": 1700,
      "status": "estimated"
    },
    {
      "id": "p2",
      "label": "Paycheck Rice Coffee Co",
      "date": "2026-10-16",
      "amount": 1700,
      "status": "estimated"
    },
    {
      "id": "p3",
      "label": "Paycheck Rice Coffee Co",
      "date": "2026-10-30",
      "amount": 1700,
      "status": "estimated"
    }
  ],
  "recurring": [
    {
      "id": "internet",
      "label": "Internet",
      "payee": "Northline Internet",
      "amount": 65,
      "day": 1,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-01",
      "cancellable": false
    },
    {
      "id": "streaming",
      "label": "Streaming",
      "payee": "Plexi",
      "amount": 30,
      "day": 3,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-03",
      "cancellable": true,
      "renews": "2026-10-03"
    },
    {
      "id": "rent",
      "label": "Rent",
      "payee": "Harbor Lofts",
      "amount": 1150,
      "day": 5,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-05",
      "cancellable": false
    },
    {
      "id": "electric",
      "label": "Electric",
      "payee": "Reliant Energy",
      "amount": 110,
      "day": 6,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-06",
      "cancellable": false,
      "lastPosted": 128,
      "lastPostedDate": "2026-09-06",
      "usual": 108,
      "unexplained": true
    },
    {
      "id": "car-insurance",
      "label": "Car insurance",
      "payee": "Geico",
      "amount": 120,
      "day": 10,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-10",
      "cancellable": false
    },
    {
      "id": "phone",
      "label": "Phone",
      "payee": "Mint Mobile",
      "amount": 45,
      "day": 12,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-12",
      "cancellable": false
    },
    {
      "id": "gym",
      "label": "Gym",
      "payee": "Fit24",
      "amount": 40,
      "day": 15,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-15",
      "cancellable": true,
      "renews": "2026-10-15"
    }
  ],
  "allowances": [
    {
      "id": "groceries",
      "label": "Groceries",
      "monthly": 700
    },
    {
      "id": "fun-other",
      "label": "Fun & other",
      "monthly": 300
    },
    {
      "id": "household",
      "label": "Household",
      "monthly": 260
    },
    {
      "id": "dining-takeout",
      "label": "Dining & takeout",
      "monthly": 180
    },
    {
      "id": "rides-transit",
      "label": "Rides & transit",
      "monthly": 60
    }
  ],
  "history": [
    {
      "m": "Jul",
      "inc": 3400,
      "out": 3055
    },
    {
      "m": "Aug",
      "inc": 3400,
      "out": 3360
    },
    {
      "m": "Sep",
      "inc": 3400,
      "out": 3378
    }
  ],
  "goal": {
    "label": "Emergency fund",
    "target": 2000,
    "saved": 800,
    "targetDate": "2027-01-02",
    "left": 4,
    "planned": 300
  }
};

export const transactions = [
  {
    "d": "Sep 27",
    "what": "Local Foods",
    "amt": -52,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "d": "Sep 26",
    "what": "H-E-B",
    "amt": -153,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "d": "Sep 25",
    "what": "METRO Houston",
    "amt": -3,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "d": "Sep 25",
    "what": "Amazon",
    "amt": -93,
    "cat": "Household",
    "k": "ev"
  },
  {
    "d": "Sep 25",
    "what": "Transfer to Emergency fund",
    "amt": -300,
    "cat": "Transfer",
    "k": "tr",
    "note": "Your own savings account. Not counted as spending."
  },
  {
    "d": "Sep 24",
    "what": "Uber",
    "amt": -12,
    "cat": "Rides & transit",
    "k": "ev",
    "note": "4 charges this month. Not treated as a subscription."
  },
  {
    "d": "Sep 23",
    "what": "Chipotle",
    "amt": -23,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "d": "Sep 22",
    "what": "Amazon",
    "amt": -48,
    "cat": "Household",
    "k": "ev"
  },
  {
    "d": "Sep 21",
    "what": "AMC Theatres",
    "amt": -58,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "d": "Sep 20",
    "what": "Kroger",
    "amt": -118,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "d": "Sep 19",
    "what": "Local Foods",
    "amt": -37,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "d": "Sep 18",
    "what": "Uber",
    "amt": -12,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "d": "Sep 18",
    "what": "Paycheck Rice Coffee Co",
    "amt": 1700,
    "cat": "Income",
    "k": "in"
  },
  {
    "d": "Sep 17",
    "what": "Museum of Fine Arts",
    "amt": -45,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "d": "Sep 16",
    "what": "Whataburger",
    "amt": -15,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "d": "Sep 15",
    "what": "Fit24",
    "amt": -40,
    "cat": "Gym",
    "k": "rec"
  },
  {
    "d": "Sep 15",
    "what": "Target",
    "amt": -88,
    "cat": "Household",
    "k": "ev"
  },
  {
    "d": "Sep 14",
    "what": "H-E-B",
    "amt": -150,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "d": "Sep 13",
    "what": "Academy Sports",
    "amt": -142,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "d": "Sep 12",
    "what": "Mint Mobile",
    "amt": -45,
    "cat": "Phone",
    "k": "rec"
  },
  {
    "d": "Sep 12",
    "what": "Uber",
    "amt": -15,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "d": "Sep 11",
    "what": "Torchy's Tacos",
    "amt": -26,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "d": "Sep 10",
    "what": "Half Price Books",
    "amt": -19,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "d": "Sep 10",
    "what": "Geico",
    "amt": -120,
    "cat": "Car insurance",
    "k": "rec"
  },
  {
    "d": "Sep 9",
    "what": "Trader Joe's",
    "amt": -102,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "d": "Sep 8",
    "what": "CVS Pharmacy",
    "amt": -31,
    "cat": "Household",
    "k": "ev"
  },
  {
    "d": "Sep 7",
    "what": "Starbucks",
    "amt": -9,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "d": "Sep 6",
    "what": "Reliant Energy",
    "amt": -128,
    "cat": "Electric",
    "k": "rec",
    "note": "Higher than usual ($108). Not confirmed why."
  },
  {
    "d": "Sep 5",
    "what": "Harbor Lofts",
    "amt": -1150,
    "cat": "Rent",
    "k": "rec"
  },
  {
    "d": "Sep 5",
    "what": "Uber",
    "amt": -18,
    "cat": "Rides & transit",
    "k": "ev"
  }
];

export const notice = "From: Northline Internet <billing@northline.example>\nTo: alex.rivera@example.com\nDate: Fri, 25 Sep 2026 09:12:04 -0500\nSubject: Your October bill\n\nHi Alex,\n\nYour Internet 300 plan will renew at $90.00 starting with your October 1 bill.\nYour 12-month promotional credit of $25.00 ended on September 30.\nYour speed and service are unchanged.\n\nQuestions? Visit support.northline.example or call the number on your bill.\n\nNorthline Internet\nAccount ending 4417\n";
>>>>>>> Stashed changes
=======
// GENERATED from data/nessie-snapshot.json — do not edit by hand.
// Regenerate with:  node scripts/build-sample.mjs
//
// Sample mode and live mode go through the same builder, so ids, categories and shapes match.
export const household = {
  "today": "2026-09-28",
  "windowDays": 34,
  "cushion": 200,
  "checking": 1260,
  "savings": 800,
  "accountIds": {
    "checking": "c9f79f65-2964-4332-97dc-85a12c108609",
    "savings": "a223b739-eb6c-4847-9e12-bdadee9def04"
  },
  "income": [
    {
      "id": "p1",
      "label": "Paycheck Rice Coffee Co",
      "date": "2026-10-02",
      "amount": 1700,
      "status": "estimated"
    },
    {
      "id": "p2",
      "label": "Paycheck Rice Coffee Co",
      "date": "2026-10-16",
      "amount": 1700,
      "status": "estimated"
    },
    {
      "id": "p3",
      "label": "Paycheck Rice Coffee Co",
      "date": "2026-10-30",
      "amount": 1700,
      "status": "estimated"
    }
  ],
  "recurring": [
    {
      "id": "internet",
      "label": "Internet",
      "payee": "Northline Internet",
      "amount": 65,
      "day": 1,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-01",
      "cancellable": false
    },
    {
      "id": "streaming",
      "label": "Streaming",
      "payee": "Plexi",
      "amount": 30,
      "day": 3,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-03",
      "cancellable": true,
      "renews": "2026-10-03"
    },
    {
      "id": "rent",
      "label": "Rent",
      "payee": "Harbor Lofts",
      "amount": 1150,
      "day": 5,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-05",
      "cancellable": false
    },
    {
      "id": "electric",
      "label": "Electric",
      "payee": "Reliant Energy",
      "amount": 110,
      "day": 6,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-06",
      "cancellable": false,
      "lastPosted": 128,
      "lastPostedDate": "2026-09-06",
      "usual": 108,
      "unexplained": true
    },
    {
      "id": "car-insurance",
      "label": "Car insurance",
      "payee": "Geico",
      "amount": 120,
      "day": 10,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-10",
      "cancellable": false
    },
    {
      "id": "phone",
      "label": "Phone",
      "payee": "Mint Mobile",
      "amount": 45,
      "day": 12,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-12",
      "cancellable": false
    },
    {
      "id": "gym",
      "label": "Gym",
      "payee": "Fit24",
      "amount": 40,
      "day": 15,
      "freq": "Monthly",
      "everyMonths": 1,
      "anchor": "2026-09-15",
      "cancellable": true,
      "renews": "2026-10-15"
    }
  ],
  "allowances": [
    {
      "id": "groceries",
      "label": "Groceries",
      "monthly": 700
    },
    {
      "id": "fun-other",
      "label": "Fun & other",
      "monthly": 300
    },
    {
      "id": "household",
      "label": "Household",
      "monthly": 260
    },
    {
      "id": "dining-takeout",
      "label": "Dining & takeout",
      "monthly": 180
    },
    {
      "id": "rides-transit",
      "label": "Rides & transit",
      "monthly": 60
    }
  ],
  "history": [
    {
      "m": "Jul",
      "inc": 3400,
      "out": 3055
    },
    {
      "m": "Aug",
      "inc": 3400,
      "out": 3360
    },
    {
      "m": "Sep",
      "inc": 3400,
      "out": 3378
    }
  ],
  "goal": {
    "label": "Emergency fund",
    "target": 2000,
    "saved": 800,
    "targetDate": "2027-01-02",
    "left": 4,
    "planned": 300
  }
};

export const transactions = [
  {
    "id": "purchase:5c0764e2-841f-4916-91c5-c857624838be",
    "sourceId": "5c0764e2-841f-4916-91c5-c857624838be",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "d6408957-ac0d-4837-9842-49d018fec043",
    "billId": null,
    "date": "2026-09-27",
    "description": "Local Foods",
    "amount": -52,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Sep 27",
    "what": "Local Foods",
    "amt": -52,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:5cd35111-bd18-4001-ae7f-e312a8e5ac1d",
    "sourceId": "5cd35111-bd18-4001-ae7f-e312a8e5ac1d",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "13ba9d2c-026a-4d4f-a65d-358958b13467",
    "billId": null,
    "date": "2026-09-26",
    "description": "H-E-B",
    "amount": -153,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Sep 26",
    "what": "H-E-B",
    "amt": -153,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:d304827b-923e-42b7-8897-af0ccfc3dac1",
    "sourceId": "d304827b-923e-42b7-8897-af0ccfc3dac1",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "e21bd399-3514-4763-bde2-d1d97a1e484b",
    "billId": null,
    "date": "2026-09-25",
    "description": "METRO Houston",
    "amount": -3,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Sep 25",
    "what": "METRO Houston",
    "amt": -3,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "purchase:e770a340-2811-48f5-b508-4231bd136ffe",
    "sourceId": "e770a340-2811-48f5-b508-4231bd136ffe",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "eade63ef-3cea-48a3-b259-12c6b277c37f",
    "billId": null,
    "date": "2026-09-25",
    "description": "Amazon",
    "amount": -93,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Sep 25",
    "what": "Amazon",
    "amt": -93,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "withdrawal:ee8dd7e5-3fe4-435a-b627-bc925bba2b9f",
    "sourceId": "ee8dd7e5-3fe4-435a-b627-bc925bba2b9f",
    "sourceType": "withdrawal",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": null,
    "billId": null,
    "date": "2026-09-25",
    "description": "Transfer to Emergency fund",
    "amount": -300,
    "kind": "transfer",
    "category": "Transfer",
    "status": "completed",
    "counterpartId": null,
    "counterpartAccountId": null,
    "relationshipStatus": "unmatched",
    "relationshipBasis": "Transfer descriptions, equal amount, same date, different owned accounts; not bank-confirmed linkage.",
    "d": "Sep 25",
    "what": "Transfer to Emergency fund",
    "amt": -300,
    "cat": "Transfer",
    "k": "tr",
    "note": "Labeled as a transfer by the bank description. Not counted as income or spending."
  },
  {
    "id": "purchase:f18c136e-d8e7-4ce9-a928-539e4120108b",
    "sourceId": "f18c136e-d8e7-4ce9-a928-539e4120108b",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "8f219061-4af7-49b6-9686-d997a82ada4c",
    "billId": null,
    "date": "2026-09-24",
    "description": "Uber",
    "amount": -12,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Sep 24",
    "what": "Uber",
    "amt": -12,
    "cat": "Rides & transit",
    "k": "ev",
    "note": "4 charges this month. Not treated as a subscription."
  },
  {
    "id": "purchase:3d70a0b0-eaac-4b81-bb8d-6c5ef62f9f94",
    "sourceId": "3d70a0b0-eaac-4b81-bb8d-6c5ef62f9f94",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "c2b5d60e-e99c-4543-a4a4-963550180589",
    "billId": null,
    "date": "2026-09-23",
    "description": "Chipotle",
    "amount": -23,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Sep 23",
    "what": "Chipotle",
    "amt": -23,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:74211702-e71c-4975-bc18-f6ffb2eb9af8",
    "sourceId": "74211702-e71c-4975-bc18-f6ffb2eb9af8",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "eade63ef-3cea-48a3-b259-12c6b277c37f",
    "billId": null,
    "date": "2026-09-22",
    "description": "Amazon",
    "amount": -48,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Sep 22",
    "what": "Amazon",
    "amt": -48,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "purchase:3a90344d-2c51-4ba2-950b-fba9a4365dc5",
    "sourceId": "3a90344d-2c51-4ba2-950b-fba9a4365dc5",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "5fccf4f1-1c27-4ab5-997d-2d02d7f5c01d",
    "billId": null,
    "date": "2026-09-21",
    "description": "AMC Theatres",
    "amount": -58,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Sep 21",
    "what": "AMC Theatres",
    "amt": -58,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:f8f65360-b545-4a9d-9eaf-ca0fac186742",
    "sourceId": "f8f65360-b545-4a9d-9eaf-ca0fac186742",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "946e0464-3261-4555-85a3-bb8c9d096e00",
    "billId": null,
    "date": "2026-09-20",
    "description": "Kroger",
    "amount": -118,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Sep 20",
    "what": "Kroger",
    "amt": -118,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:03eb2bf7-4d0d-45d4-87b8-6343234a40cb",
    "sourceId": "03eb2bf7-4d0d-45d4-87b8-6343234a40cb",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "d6408957-ac0d-4837-9842-49d018fec043",
    "billId": null,
    "date": "2026-09-19",
    "description": "Local Foods",
    "amount": -37,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Sep 19",
    "what": "Local Foods",
    "amt": -37,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "deposit:9e748279-1b5c-4a37-b30e-ae1a228d3e0e",
    "sourceId": "9e748279-1b5c-4a37-b30e-ae1a228d3e0e",
    "sourceType": "deposit",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": null,
    "billId": null,
    "date": "2026-09-18",
    "description": "Paycheck Rice Coffee Co",
    "amount": 1700,
    "kind": "income",
    "category": "Income",
    "status": "completed",
    "d": "Sep 18",
    "what": "Paycheck Rice Coffee Co",
    "amt": 1700,
    "cat": "Income",
    "k": "in"
  },
  {
    "id": "purchase:6c6b45ce-4184-4ce4-a2bc-c9d69df94690",
    "sourceId": "6c6b45ce-4184-4ce4-a2bc-c9d69df94690",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "8f219061-4af7-49b6-9686-d997a82ada4c",
    "billId": null,
    "date": "2026-09-18",
    "description": "Uber",
    "amount": -12,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Sep 18",
    "what": "Uber",
    "amt": -12,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "purchase:65d7c692-c773-4687-b4e1-546a196e5a51",
    "sourceId": "65d7c692-c773-4687-b4e1-546a196e5a51",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "1e0b9e9f-6340-459a-b740-309317df34ed",
    "billId": null,
    "date": "2026-09-17",
    "description": "Museum of Fine Arts",
    "amount": -45,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Sep 17",
    "what": "Museum of Fine Arts",
    "amt": -45,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:a9ec05b5-f7e2-4b8b-a4cc-fd57b0da17df",
    "sourceId": "a9ec05b5-f7e2-4b8b-a4cc-fd57b0da17df",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "aaa08aaf-fdbb-4b72-867f-06d081e81fa9",
    "billId": null,
    "date": "2026-09-16",
    "description": "Whataburger",
    "amount": -15,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Sep 16",
    "what": "Whataburger",
    "amt": -15,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:7d1a25ce-6606-427f-9f11-c36014ec0335",
    "sourceId": "7d1a25ce-6606-427f-9f11-c36014ec0335",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "e95529f8-a176-4f29-bc6d-47f72bae03e6",
    "billId": "21fba070-1508-4366-a66f-aa25b9db267e",
    "date": "2026-09-15",
    "description": "Fit24",
    "amount": -40,
    "kind": "bill",
    "category": "Gym",
    "status": "completed",
    "d": "Sep 15",
    "what": "Fit24",
    "amt": -40,
    "cat": "Gym",
    "k": "rec"
  },
  {
    "id": "purchase:b37bb8a1-663c-4f38-a924-72c496f9951e",
    "sourceId": "b37bb8a1-663c-4f38-a924-72c496f9951e",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "65915993-a5c8-4527-ac34-bf8757c584b4",
    "billId": null,
    "date": "2026-09-15",
    "description": "Target",
    "amount": -88,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Sep 15",
    "what": "Target",
    "amt": -88,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "purchase:131effaf-d166-42be-9b97-4daf1dc25cf2",
    "sourceId": "131effaf-d166-42be-9b97-4daf1dc25cf2",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "13ba9d2c-026a-4d4f-a65d-358958b13467",
    "billId": null,
    "date": "2026-09-14",
    "description": "H-E-B",
    "amount": -150,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Sep 14",
    "what": "H-E-B",
    "amt": -150,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:e32a2ec6-9ae0-4820-8e2d-43016bf08cd6",
    "sourceId": "e32a2ec6-9ae0-4820-8e2d-43016bf08cd6",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "419d5bb4-7d67-44d0-bd7c-b5b5ed5d0389",
    "billId": null,
    "date": "2026-09-13",
    "description": "Academy Sports",
    "amount": -142,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Sep 13",
    "what": "Academy Sports",
    "amt": -142,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:1dc6cba8-9f23-4d0c-b135-dafc8d621887",
    "sourceId": "1dc6cba8-9f23-4d0c-b135-dafc8d621887",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "130eec47-87a4-4b2b-93e0-cfcdba49bb10",
    "billId": "e6105e8e-589c-4e2c-a99d-6c08cd76c023",
    "date": "2026-09-12",
    "description": "Mint Mobile",
    "amount": -45,
    "kind": "bill",
    "category": "Phone",
    "status": "completed",
    "d": "Sep 12",
    "what": "Mint Mobile",
    "amt": -45,
    "cat": "Phone",
    "k": "rec"
  },
  {
    "id": "purchase:7ae978b3-56ad-449e-ae1b-56ce7f256c31",
    "sourceId": "7ae978b3-56ad-449e-ae1b-56ce7f256c31",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "8f219061-4af7-49b6-9686-d997a82ada4c",
    "billId": null,
    "date": "2026-09-12",
    "description": "Uber",
    "amount": -15,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Sep 12",
    "what": "Uber",
    "amt": -15,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "purchase:07c6f94d-2ff9-4a86-8610-5bd73306dd1b",
    "sourceId": "07c6f94d-2ff9-4a86-8610-5bd73306dd1b",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "baa87831-11ce-4472-a5ff-df284ab690a7",
    "billId": null,
    "date": "2026-09-11",
    "description": "Torchy's Tacos",
    "amount": -26,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Sep 11",
    "what": "Torchy's Tacos",
    "amt": -26,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:025670df-5382-41ea-bcc1-f3edac77b0c9",
    "sourceId": "025670df-5382-41ea-bcc1-f3edac77b0c9",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "e068b65a-6c15-4387-84b2-a09fa23149d5",
    "billId": null,
    "date": "2026-09-10",
    "description": "Half Price Books",
    "amount": -19,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Sep 10",
    "what": "Half Price Books",
    "amt": -19,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:6ba30ac9-e5d0-46fc-b277-9069bf155d45",
    "sourceId": "6ba30ac9-e5d0-46fc-b277-9069bf155d45",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "61ea0a9e-859b-4d25-a02c-729ae72ff019",
    "billId": "8e90e7a4-6c0b-454a-b6a3-a6788c500e91",
    "date": "2026-09-10",
    "description": "Geico",
    "amount": -120,
    "kind": "bill",
    "category": "Car insurance",
    "status": "completed",
    "d": "Sep 10",
    "what": "Geico",
    "amt": -120,
    "cat": "Car insurance",
    "k": "rec"
  },
  {
    "id": "purchase:1bfcf697-d7ab-4ec1-814c-ea74f79ece96",
    "sourceId": "1bfcf697-d7ab-4ec1-814c-ea74f79ece96",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "b3e8bacc-74e8-4252-a528-cff26aa374f7",
    "billId": null,
    "date": "2026-09-09",
    "description": "Trader Joe's",
    "amount": -102,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Sep 9",
    "what": "Trader Joe's",
    "amt": -102,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:4408d728-0ef8-462c-850d-e5bd9cc83aa4",
    "sourceId": "4408d728-0ef8-462c-850d-e5bd9cc83aa4",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "3a3dd728-d6e1-411b-91fb-4e1934261193",
    "billId": null,
    "date": "2026-09-08",
    "description": "CVS Pharmacy",
    "amount": -31,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Sep 8",
    "what": "CVS Pharmacy",
    "amt": -31,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "purchase:9766e42c-159d-4f7c-bb9d-09c8acb54a3e",
    "sourceId": "9766e42c-159d-4f7c-bb9d-09c8acb54a3e",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "37fc2442-45a4-4a9a-b77f-1890a009da0f",
    "billId": null,
    "date": "2026-09-07",
    "description": "Starbucks",
    "amount": -9,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Sep 7",
    "what": "Starbucks",
    "amt": -9,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:75d26d74-2e68-417a-80b3-0aa063b51c5b",
    "sourceId": "75d26d74-2e68-417a-80b3-0aa063b51c5b",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "01066957-62e7-4b41-bf2d-b2ff20c3f7f8",
    "billId": "1635cf93-a2e0-417d-8234-95ffe144c791",
    "date": "2026-09-06",
    "description": "Reliant Energy",
    "amount": -128,
    "kind": "bill",
    "category": "Electric",
    "status": "completed",
    "d": "Sep 6",
    "what": "Reliant Energy",
    "amt": -128,
    "cat": "Electric",
    "k": "rec",
    "note": "Higher than usual ($108). Not confirmed why."
  },
  {
    "id": "purchase:55352e49-8e9e-4c9d-a28c-7c79c30270d6",
    "sourceId": "55352e49-8e9e-4c9d-a28c-7c79c30270d6",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "24434a3e-6e67-4132-a6c9-189ea78a360b",
    "billId": "9d4c4ae3-52ec-41c5-9960-c8c5f7d0db9c",
    "date": "2026-09-05",
    "description": "Harbor Lofts",
    "amount": -1150,
    "kind": "bill",
    "category": "Rent",
    "status": "completed",
    "d": "Sep 5",
    "what": "Harbor Lofts",
    "amt": -1150,
    "cat": "Rent",
    "k": "rec"
  },
  {
    "id": "purchase:875de218-44f2-47eb-9a7c-12e5b3adf476",
    "sourceId": "875de218-44f2-47eb-9a7c-12e5b3adf476",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "8f219061-4af7-49b6-9686-d997a82ada4c",
    "billId": null,
    "date": "2026-09-05",
    "description": "Uber",
    "amount": -18,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Sep 5",
    "what": "Uber",
    "amt": -18,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "deposit:4fd2bf9d-3b66-408b-b6a2-9b098517f126",
    "sourceId": "4fd2bf9d-3b66-408b-b6a2-9b098517f126",
    "sourceType": "deposit",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": null,
    "billId": null,
    "date": "2026-09-04",
    "description": "Paycheck Rice Coffee Co",
    "amount": 1700,
    "kind": "income",
    "category": "Income",
    "status": "completed",
    "d": "Sep 4",
    "what": "Paycheck Rice Coffee Co",
    "amt": 1700,
    "cat": "Income",
    "k": "in"
  },
  {
    "id": "purchase:06275ead-fa7d-436d-af55-1f4d17d99c00",
    "sourceId": "06275ead-fa7d-436d-af55-1f4d17d99c00",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "5fccf4f1-1c27-4ab5-997d-2d02d7f5c01d",
    "billId": null,
    "date": "2026-09-04",
    "description": "AMC Theatres",
    "amount": -36,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Sep 4",
    "what": "AMC Theatres",
    "amt": -36,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:6317440c-ea40-4110-9eae-8a149a19caca",
    "sourceId": "6317440c-ea40-4110-9eae-8a149a19caca",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "ddffc10e-4157-4667-bc5c-e262ea13282d",
    "billId": "c0cdb1dd-0ff0-4dbb-a9e3-cd5fe9a18d11",
    "date": "2026-09-03",
    "description": "Plexi",
    "amount": -30,
    "kind": "bill",
    "category": "Streaming",
    "status": "completed",
    "d": "Sep 3",
    "what": "Plexi",
    "amt": -30,
    "cat": "Streaming",
    "k": "rec"
  },
  {
    "id": "purchase:9efc0ef4-22cf-4a8e-8371-1b213bf2bb5e",
    "sourceId": "9efc0ef4-22cf-4a8e-8371-1b213bf2bb5e",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "c2b5d60e-e99c-4543-a4a4-963550180589",
    "billId": null,
    "date": "2026-09-03",
    "description": "Chipotle",
    "amount": -18,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Sep 3",
    "what": "Chipotle",
    "amt": -18,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:bcc14979-5e21-4629-ad64-c15474627ec0",
    "sourceId": "bcc14979-5e21-4629-ad64-c15474627ec0",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "946e0464-3261-4555-85a3-bb8c9d096e00",
    "billId": null,
    "date": "2026-09-02",
    "description": "Kroger",
    "amount": -177,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Sep 2",
    "what": "Kroger",
    "amt": -177,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:2bb1bb31-7ee4-464b-8fa2-e1351e4af4fb",
    "sourceId": "2bb1bb31-7ee4-464b-8fa2-e1351e4af4fb",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "3beb7b2d-444b-49b4-8876-927a855b27c7",
    "billId": "195606fd-55de-441a-b5e5-b2bc7a46b9e8",
    "date": "2026-09-01",
    "description": "Northline Internet",
    "amount": -65,
    "kind": "bill",
    "category": "Internet",
    "status": "completed",
    "d": "Sep 1",
    "what": "Northline Internet",
    "amt": -65,
    "cat": "Internet",
    "k": "rec"
  },
  {
    "id": "purchase:5c794425-008e-4630-be17-72a297044976",
    "sourceId": "5c794425-008e-4630-be17-72a297044976",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "e068b65a-6c15-4387-84b2-a09fa23149d5",
    "billId": null,
    "date": "2026-08-30",
    "description": "Half Price Books",
    "amount": -76,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Aug 30",
    "what": "Half Price Books",
    "amt": -76,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:4046032e-c6e4-4f9c-9a6a-12bb4186db8d",
    "sourceId": "4046032e-c6e4-4f9c-9a6a-12bb4186db8d",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "c2b5d60e-e99c-4543-a4a4-963550180589",
    "billId": null,
    "date": "2026-08-29",
    "description": "Chipotle",
    "amount": -41,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Aug 29",
    "what": "Chipotle",
    "amt": -41,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:b702b73f-b1e4-4c07-ab6f-849637c25993",
    "sourceId": "b702b73f-b1e4-4c07-ab6f-849637c25993",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "13ba9d2c-026a-4d4f-a65d-358958b13467",
    "billId": null,
    "date": "2026-08-28",
    "description": "H-E-B",
    "amount": -133,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Aug 28",
    "what": "H-E-B",
    "amt": -133,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:bddc2b7f-8c77-4862-a21d-cdb37ff72c8d",
    "sourceId": "bddc2b7f-8c77-4862-a21d-cdb37ff72c8d",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "8f219061-4af7-49b6-9686-d997a82ada4c",
    "billId": null,
    "date": "2026-08-27",
    "description": "Uber",
    "amount": -23,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Aug 27",
    "what": "Uber",
    "amt": -23,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "purchase:11e53119-4511-4203-b355-dbc9db081a40",
    "sourceId": "11e53119-4511-4203-b355-dbc9db081a40",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "eade63ef-3cea-48a3-b259-12c6b277c37f",
    "billId": null,
    "date": "2026-08-26",
    "description": "Amazon",
    "amount": -94,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Aug 26",
    "what": "Amazon",
    "amt": -94,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "withdrawal:55032981-c127-4d9f-8c06-69da84e33b6b",
    "sourceId": "55032981-c127-4d9f-8c06-69da84e33b6b",
    "sourceType": "withdrawal",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": null,
    "billId": null,
    "date": "2026-08-25",
    "description": "Transfer to Emergency fund",
    "amount": -300,
    "kind": "transfer",
    "category": "Transfer",
    "status": "completed",
    "counterpartId": null,
    "counterpartAccountId": null,
    "relationshipStatus": "unmatched",
    "relationshipBasis": "Transfer descriptions, equal amount, same date, different owned accounts; not bank-confirmed linkage.",
    "d": "Aug 25",
    "what": "Transfer to Emergency fund",
    "amt": -300,
    "cat": "Transfer",
    "k": "tr",
    "note": "Labeled as a transfer by the bank description. Not counted as income or spending."
  },
  {
    "id": "purchase:4c2583c7-27af-43eb-818f-333ccfe5d658",
    "sourceId": "4c2583c7-27af-43eb-818f-333ccfe5d658",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "d6408957-ac0d-4837-9842-49d018fec043",
    "billId": null,
    "date": "2026-08-24",
    "description": "Local Foods",
    "amount": -45,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Aug 24",
    "what": "Local Foods",
    "amt": -45,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:fbbd1c7e-7a46-41dd-affd-93f9344705a7",
    "sourceId": "fbbd1c7e-7a46-41dd-affd-93f9344705a7",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "419d5bb4-7d67-44d0-bd7c-b5b5ed5d0389",
    "billId": null,
    "date": "2026-08-22",
    "description": "Academy Sports",
    "amount": -165,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Aug 22",
    "what": "Academy Sports",
    "amt": -165,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "deposit:20ae9462-06a9-4034-bdd0-5f3a5b5d0167",
    "sourceId": "20ae9462-06a9-4034-bdd0-5f3a5b5d0167",
    "sourceType": "deposit",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": null,
    "billId": null,
    "date": "2026-08-21",
    "description": "Paycheck Rice Coffee Co",
    "amount": 1700,
    "kind": "income",
    "category": "Income",
    "status": "completed",
    "d": "Aug 21",
    "what": "Paycheck Rice Coffee Co",
    "amt": 1700,
    "cat": "Income",
    "k": "in"
  },
  {
    "id": "purchase:5f4402de-536c-4065-8615-e48652a89063",
    "sourceId": "5f4402de-536c-4065-8615-e48652a89063",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "946e0464-3261-4555-85a3-bb8c9d096e00",
    "billId": null,
    "date": "2026-08-21",
    "description": "Kroger",
    "amount": -135,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Aug 21",
    "what": "Kroger",
    "amt": -135,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:ef1b86d8-53ab-4108-9dec-7d0c9f388b8e",
    "sourceId": "ef1b86d8-53ab-4108-9dec-7d0c9f388b8e",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "37fc2442-45a4-4a9a-b77f-1890a009da0f",
    "billId": null,
    "date": "2026-08-20",
    "description": "Starbucks",
    "amount": -14,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Aug 20",
    "what": "Starbucks",
    "amt": -14,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:b052e1f1-e123-4692-8856-ae3f699318cd",
    "sourceId": "b052e1f1-e123-4692-8856-ae3f699318cd",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "e21bd399-3514-4763-bde2-d1d97a1e484b",
    "billId": null,
    "date": "2026-08-19",
    "description": "METRO Houston",
    "amount": -3,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Aug 19",
    "what": "METRO Houston",
    "amt": -3,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "purchase:9561e723-3d4b-428c-856f-97486d1c1b76",
    "sourceId": "9561e723-3d4b-428c-856f-97486d1c1b76",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "3a3dd728-d6e1-411b-91fb-4e1934261193",
    "billId": null,
    "date": "2026-08-18",
    "description": "CVS Pharmacy",
    "amount": -18,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Aug 18",
    "what": "CVS Pharmacy",
    "amt": -18,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "purchase:23626cb1-7f0f-452a-9ac0-d8de73206739",
    "sourceId": "23626cb1-7f0f-452a-9ac0-d8de73206739",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "baa87831-11ce-4472-a5ff-df284ab690a7",
    "billId": null,
    "date": "2026-08-16",
    "description": "Torchy's Tacos",
    "amount": -32,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Aug 16",
    "what": "Torchy's Tacos",
    "amt": -32,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:20c04655-c4a1-4cda-85c3-17008a7b3d51",
    "sourceId": "20c04655-c4a1-4cda-85c3-17008a7b3d51",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "e95529f8-a176-4f29-bc6d-47f72bae03e6",
    "billId": "21fba070-1508-4366-a66f-aa25b9db267e",
    "date": "2026-08-15",
    "description": "Fit24",
    "amount": -40,
    "kind": "bill",
    "category": "Gym",
    "status": "completed",
    "d": "Aug 15",
    "what": "Fit24",
    "amt": -40,
    "cat": "Gym",
    "k": "rec"
  },
  {
    "id": "purchase:7f12c614-2c0d-41aa-a45e-bd65f235d50e",
    "sourceId": "7f12c614-2c0d-41aa-a45e-bd65f235d50e",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "b3e8bacc-74e8-4252-a528-cff26aa374f7",
    "billId": null,
    "date": "2026-08-15",
    "description": "Trader Joe's",
    "amount": -88,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Aug 15",
    "what": "Trader Joe's",
    "amt": -88,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:b6270949-1d3d-48c8-bd9c-6a0f59cce336",
    "sourceId": "b6270949-1d3d-48c8-bd9c-6a0f59cce336",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "1e0b9e9f-6340-459a-b740-309317df34ed",
    "billId": null,
    "date": "2026-08-14",
    "description": "Museum of Fine Arts",
    "amount": -30,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Aug 14",
    "what": "Museum of Fine Arts",
    "amt": -30,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:6778ea46-d3ed-4c8f-a1bd-8d6c68f38fc7",
    "sourceId": "6778ea46-d3ed-4c8f-a1bd-8d6c68f38fc7",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "8f219061-4af7-49b6-9686-d997a82ada4c",
    "billId": null,
    "date": "2026-08-13",
    "description": "Uber",
    "amount": -20,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Aug 13",
    "what": "Uber",
    "amt": -20,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "purchase:7c8f5f6a-b1a7-4962-900b-da548d7e2687",
    "sourceId": "7c8f5f6a-b1a7-4962-900b-da548d7e2687",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "130eec47-87a4-4b2b-93e0-cfcdba49bb10",
    "billId": "e6105e8e-589c-4e2c-a99d-6c08cd76c023",
    "date": "2026-08-12",
    "description": "Mint Mobile",
    "amount": -45,
    "kind": "bill",
    "category": "Phone",
    "status": "completed",
    "d": "Aug 12",
    "what": "Mint Mobile",
    "amt": -45,
    "cat": "Phone",
    "k": "rec"
  },
  {
    "id": "purchase:8d98678b-d845-4e26-b0e6-350847efd9e2",
    "sourceId": "8d98678b-d845-4e26-b0e6-350847efd9e2",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "aaa08aaf-fdbb-4b72-867f-06d081e81fa9",
    "billId": null,
    "date": "2026-08-12",
    "description": "Whataburger",
    "amount": -17,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Aug 12",
    "what": "Whataburger",
    "amt": -17,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:4e2d54b3-669b-490a-b3a8-344c6d379bae",
    "sourceId": "4e2d54b3-669b-490a-b3a8-344c6d379bae",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "eade63ef-3cea-48a3-b259-12c6b277c37f",
    "billId": null,
    "date": "2026-08-11",
    "description": "Amazon",
    "amount": -36,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Aug 11",
    "what": "Amazon",
    "amt": -36,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "purchase:05f750df-a266-4fae-860d-293a23a2b70a",
    "sourceId": "05f750df-a266-4fae-860d-293a23a2b70a",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "61ea0a9e-859b-4d25-a02c-729ae72ff019",
    "billId": "8e90e7a4-6c0b-454a-b6a3-a6788c500e91",
    "date": "2026-08-10",
    "description": "Geico",
    "amount": -120,
    "kind": "bill",
    "category": "Car insurance",
    "status": "completed",
    "d": "Aug 10",
    "what": "Geico",
    "amt": -120,
    "cat": "Car insurance",
    "k": "rec"
  },
  {
    "id": "purchase:ff62c462-c837-4006-bdaf-1500811d3cab",
    "sourceId": "ff62c462-c837-4006-bdaf-1500811d3cab",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "5fccf4f1-1c27-4ab5-997d-2d02d7f5c01d",
    "billId": null,
    "date": "2026-08-09",
    "description": "AMC Theatres",
    "amount": -29,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Aug 9",
    "what": "AMC Theatres",
    "amt": -29,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:e92dcbf7-fe0a-4db1-bd6c-cf86fef64b05",
    "sourceId": "e92dcbf7-fe0a-4db1-bd6c-cf86fef64b05",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "946e0464-3261-4555-85a3-bb8c9d096e00",
    "billId": null,
    "date": "2026-08-08",
    "description": "Kroger",
    "amount": -188,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Aug 8",
    "what": "Kroger",
    "amt": -188,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "deposit:5bf6ee1d-3b2e-4bde-aa45-a947e3f583ef",
    "sourceId": "5bf6ee1d-3b2e-4bde-aa45-a947e3f583ef",
    "sourceType": "deposit",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": null,
    "billId": null,
    "date": "2026-08-07",
    "description": "Paycheck Rice Coffee Co",
    "amount": 1700,
    "kind": "income",
    "category": "Income",
    "status": "completed",
    "d": "Aug 7",
    "what": "Paycheck Rice Coffee Co",
    "amt": 1700,
    "cat": "Income",
    "k": "in"
  },
  {
    "id": "purchase:5941017a-0eae-4d36-a0fa-121a7c1c342d",
    "sourceId": "5941017a-0eae-4d36-a0fa-121a7c1c342d",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "c2b5d60e-e99c-4543-a4a4-963550180589",
    "billId": null,
    "date": "2026-08-07",
    "description": "Chipotle",
    "amount": -22,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Aug 7",
    "what": "Chipotle",
    "amt": -22,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:0fb944dd-6828-4aa2-b8d0-08caaede2d87",
    "sourceId": "0fb944dd-6828-4aa2-b8d0-08caaede2d87",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "01066957-62e7-4b41-bf2d-b2ff20c3f7f8",
    "billId": "1635cf93-a2e0-417d-8234-95ffe144c791",
    "date": "2026-08-06",
    "description": "Reliant Energy",
    "amount": -110,
    "kind": "bill",
    "category": "Electric",
    "status": "completed",
    "d": "Aug 6",
    "what": "Reliant Energy",
    "amt": -110,
    "cat": "Electric",
    "k": "rec"
  },
  {
    "id": "purchase:f42171e6-5bb4-40e4-afbc-c4f6dd7fe561",
    "sourceId": "f42171e6-5bb4-40e4-afbc-c4f6dd7fe561",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "8f219061-4af7-49b6-9686-d997a82ada4c",
    "billId": null,
    "date": "2026-08-06",
    "description": "Uber",
    "amount": -14,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Aug 6",
    "what": "Uber",
    "amt": -14,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "purchase:ac70b7be-eb84-4068-b50a-d724a4928e9f",
    "sourceId": "ac70b7be-eb84-4068-b50a-d724a4928e9f",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "24434a3e-6e67-4132-a6c9-189ea78a360b",
    "billId": "9d4c4ae3-52ec-41c5-9960-c8c5f7d0db9c",
    "date": "2026-08-05",
    "description": "Harbor Lofts",
    "amount": -1150,
    "kind": "bill",
    "category": "Rent",
    "status": "completed",
    "d": "Aug 5",
    "what": "Harbor Lofts",
    "amt": -1150,
    "cat": "Rent",
    "k": "rec"
  },
  {
    "id": "purchase:b5d0a62e-84ff-440f-ad00-d7b64004b918",
    "sourceId": "b5d0a62e-84ff-440f-ad00-d7b64004b918",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "65915993-a5c8-4527-ac34-bf8757c584b4",
    "billId": null,
    "date": "2026-08-05",
    "description": "Target",
    "amount": -112,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Aug 5",
    "what": "Target",
    "amt": -112,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "purchase:6e4987de-afd2-4706-8807-2598c84de97b",
    "sourceId": "6e4987de-afd2-4706-8807-2598c84de97b",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "37fc2442-45a4-4a9a-b77f-1890a009da0f",
    "billId": null,
    "date": "2026-08-04",
    "description": "Starbucks",
    "amount": -9,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Aug 4",
    "what": "Starbucks",
    "amt": -9,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:dc756f41-cc9c-44b5-891b-22125f35284f",
    "sourceId": "dc756f41-cc9c-44b5-891b-22125f35284f",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "ddffc10e-4157-4667-bc5c-e262ea13282d",
    "billId": "c0cdb1dd-0ff0-4dbb-a9e3-cd5fe9a18d11",
    "date": "2026-08-03",
    "description": "Plexi",
    "amount": -30,
    "kind": "bill",
    "category": "Streaming",
    "status": "completed",
    "d": "Aug 3",
    "what": "Plexi",
    "amt": -30,
    "cat": "Streaming",
    "k": "rec"
  },
  {
    "id": "purchase:bb9d3b46-73c1-4d60-ab5f-55d2dedce65f",
    "sourceId": "bb9d3b46-73c1-4d60-ab5f-55d2dedce65f",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "13ba9d2c-026a-4d4f-a65d-358958b13467",
    "billId": null,
    "date": "2026-08-02",
    "description": "H-E-B",
    "amount": -156,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Aug 2",
    "what": "H-E-B",
    "amt": -156,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:29a3e764-a319-44eb-84d3-3fdf57667782",
    "sourceId": "29a3e764-a319-44eb-84d3-3fdf57667782",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "3beb7b2d-444b-49b4-8876-927a855b27c7",
    "billId": "195606fd-55de-441a-b5e5-b2bc7a46b9e8",
    "date": "2026-08-01",
    "description": "Northline Internet",
    "amount": -65,
    "kind": "bill",
    "category": "Internet",
    "status": "completed",
    "d": "Aug 1",
    "what": "Northline Internet",
    "amt": -65,
    "cat": "Internet",
    "k": "rec"
  },
  {
    "id": "purchase:e36f6d95-5117-4902-b19c-98292a14a4be",
    "sourceId": "e36f6d95-5117-4902-b19c-98292a14a4be",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "5fccf4f1-1c27-4ab5-997d-2d02d7f5c01d",
    "billId": null,
    "date": "2026-07-30",
    "description": "AMC Theatres",
    "amount": -68,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Jul 30",
    "what": "AMC Theatres",
    "amt": -68,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:1f3ca868-bdbf-4974-a1f6-a25a8c171907",
    "sourceId": "1f3ca868-bdbf-4974-a1f6-a25a8c171907",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "13ba9d2c-026a-4d4f-a65d-358958b13467",
    "billId": null,
    "date": "2026-07-29",
    "description": "H-E-B",
    "amount": -172,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Jul 29",
    "what": "H-E-B",
    "amt": -172,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:e1212c02-4fe3-4ef0-9242-be0ff95e5485",
    "sourceId": "e1212c02-4fe3-4ef0-9242-be0ff95e5485",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "eade63ef-3cea-48a3-b259-12c6b277c37f",
    "billId": null,
    "date": "2026-07-28",
    "description": "Amazon",
    "amount": -92,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Jul 28",
    "what": "Amazon",
    "amt": -92,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "purchase:9370576c-47ce-433d-8a4e-1e85050147a0",
    "sourceId": "9370576c-47ce-433d-8a4e-1e85050147a0",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "d6408957-ac0d-4837-9842-49d018fec043",
    "billId": null,
    "date": "2026-07-27",
    "description": "Local Foods",
    "amount": -62,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Jul 27",
    "what": "Local Foods",
    "amt": -62,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:89336c54-87e3-4a76-ba56-1322cd87e4ab",
    "sourceId": "89336c54-87e3-4a76-ba56-1322cd87e4ab",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "8f219061-4af7-49b6-9686-d997a82ada4c",
    "billId": null,
    "date": "2026-07-26",
    "description": "Uber",
    "amount": -16,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Jul 26",
    "what": "Uber",
    "amt": -16,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "deposit:f3dbc554-a9d0-4948-bf72-f00cb640ad23",
    "sourceId": "f3dbc554-a9d0-4948-bf72-f00cb640ad23",
    "sourceType": "deposit",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": null,
    "billId": null,
    "date": "2026-07-24",
    "description": "Paycheck Rice Coffee Co",
    "amount": 1700,
    "kind": "income",
    "category": "Income",
    "status": "completed",
    "d": "Jul 24",
    "what": "Paycheck Rice Coffee Co",
    "amt": 1700,
    "cat": "Income",
    "k": "in"
  },
  {
    "id": "purchase:b7dfb5fc-1145-43c8-87ab-c01cb881b16d",
    "sourceId": "b7dfb5fc-1145-43c8-87ab-c01cb881b16d",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "419d5bb4-7d67-44d0-bd7c-b5b5ed5d0389",
    "billId": null,
    "date": "2026-07-24",
    "description": "Academy Sports",
    "amount": -129,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Jul 24",
    "what": "Academy Sports",
    "amt": -129,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:ef59122a-0ca0-4162-9cde-054c0d42bffd",
    "sourceId": "ef59122a-0ca0-4162-9cde-054c0d42bffd",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "d6408957-ac0d-4837-9842-49d018fec043",
    "billId": null,
    "date": "2026-07-23",
    "description": "Local Foods",
    "amount": -29,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Jul 23",
    "what": "Local Foods",
    "amt": -29,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:a06ef91e-fb44-4979-9405-b79addb2e149",
    "sourceId": "a06ef91e-fb44-4979-9405-b79addb2e149",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "b3e8bacc-74e8-4252-a528-cff26aa374f7",
    "billId": null,
    "date": "2026-07-22",
    "description": "Trader Joe's",
    "amount": -121,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Jul 22",
    "what": "Trader Joe's",
    "amt": -121,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:c120804d-74a7-41b2-88f3-193653dd9b16",
    "sourceId": "c120804d-74a7-41b2-88f3-193653dd9b16",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "1e0b9e9f-6340-459a-b740-309317df34ed",
    "billId": null,
    "date": "2026-07-21",
    "description": "Museum of Fine Arts",
    "amount": -45,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Jul 21",
    "what": "Museum of Fine Arts",
    "amt": -45,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:8c808e59-f2c1-4a01-bcf1-0e97a9f5761d",
    "sourceId": "8c808e59-f2c1-4a01-bcf1-0e97a9f5761d",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "3a3dd728-d6e1-411b-91fb-4e1934261193",
    "billId": null,
    "date": "2026-07-20",
    "description": "CVS Pharmacy",
    "amount": -24,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Jul 20",
    "what": "CVS Pharmacy",
    "amt": -24,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "purchase:8ac5cf6d-4e3b-46fc-9393-4bfd269b6d3c",
    "sourceId": "8ac5cf6d-4e3b-46fc-9393-4bfd269b6d3c",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "8f219061-4af7-49b6-9686-d997a82ada4c",
    "billId": null,
    "date": "2026-07-19",
    "description": "Uber",
    "amount": -23,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Jul 19",
    "what": "Uber",
    "amt": -23,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "purchase:bb107c33-80ab-4f37-85d6-9fccd5df9643",
    "sourceId": "bb107c33-80ab-4f37-85d6-9fccd5df9643",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "baa87831-11ce-4472-a5ff-df284ab690a7",
    "billId": null,
    "date": "2026-07-18",
    "description": "Torchy's Tacos",
    "amount": -34,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Jul 18",
    "what": "Torchy's Tacos",
    "amt": -34,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:0e4d0fc9-585e-4beb-945a-0dfbe7963c02",
    "sourceId": "0e4d0fc9-585e-4beb-945a-0dfbe7963c02",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "946e0464-3261-4555-85a3-bb8c9d096e00",
    "billId": null,
    "date": "2026-07-16",
    "description": "Kroger",
    "amount": -97,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Jul 16",
    "what": "Kroger",
    "amt": -97,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:0ad27ae6-e381-4dd5-8a67-a725a3f2f76d",
    "sourceId": "0ad27ae6-e381-4dd5-8a67-a725a3f2f76d",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "e068b65a-6c15-4387-84b2-a09fa23149d5",
    "billId": null,
    "date": "2026-07-15",
    "description": "Half Price Books",
    "amount": -25,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Jul 15",
    "what": "Half Price Books",
    "amt": -25,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:2993412d-b430-4bca-8d63-7d2213d4164c",
    "sourceId": "2993412d-b430-4bca-8d63-7d2213d4164c",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "e95529f8-a176-4f29-bc6d-47f72bae03e6",
    "billId": "21fba070-1508-4366-a66f-aa25b9db267e",
    "date": "2026-07-15",
    "description": "Fit24",
    "amount": -40,
    "kind": "bill",
    "category": "Gym",
    "status": "completed",
    "d": "Jul 15",
    "what": "Fit24",
    "amt": -40,
    "cat": "Gym",
    "k": "rec"
  },
  {
    "id": "purchase:9e84cdfd-958c-47ef-87ba-980439d24506",
    "sourceId": "9e84cdfd-958c-47ef-87ba-980439d24506",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "c2b5d60e-e99c-4543-a4a4-963550180589",
    "billId": null,
    "date": "2026-07-14",
    "description": "Chipotle",
    "amount": -19,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Jul 14",
    "what": "Chipotle",
    "amt": -19,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:deaaedad-ad93-40cf-8852-90721811f3bd",
    "sourceId": "deaaedad-ad93-40cf-8852-90721811f3bd",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "65915993-a5c8-4527-ac34-bf8757c584b4",
    "billId": null,
    "date": "2026-07-13",
    "description": "Target",
    "amount": -96,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Jul 13",
    "what": "Target",
    "amt": -96,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "purchase:2e9337ba-5caf-4560-8b30-c34b5d68e73c",
    "sourceId": "2e9337ba-5caf-4560-8b30-c34b5d68e73c",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "130eec47-87a4-4b2b-93e0-cfcdba49bb10",
    "billId": "e6105e8e-589c-4e2c-a99d-6c08cd76c023",
    "date": "2026-07-12",
    "description": "Mint Mobile",
    "amount": -45,
    "kind": "bill",
    "category": "Phone",
    "status": "completed",
    "d": "Jul 12",
    "what": "Mint Mobile",
    "amt": -45,
    "cat": "Phone",
    "k": "rec"
  },
  {
    "id": "purchase:939084f4-6e8b-46cd-bba3-424c85fb7ab3",
    "sourceId": "939084f4-6e8b-46cd-bba3-424c85fb7ab3",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "e21bd399-3514-4763-bde2-d1d97a1e484b",
    "billId": null,
    "date": "2026-07-12",
    "description": "METRO Houston",
    "amount": -3,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Jul 12",
    "what": "METRO Houston",
    "amt": -3,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "purchase:298f586a-e143-46fb-9c96-fd6d325910b2",
    "sourceId": "298f586a-e143-46fb-9c96-fd6d325910b2",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "aaa08aaf-fdbb-4b72-867f-06d081e81fa9",
    "billId": null,
    "date": "2026-07-11",
    "description": "Whataburger",
    "amount": -12,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Jul 11",
    "what": "Whataburger",
    "amt": -12,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "deposit:9182f9d3-6911-493c-ae0a-e8607305fd69",
    "sourceId": "9182f9d3-6911-493c-ae0a-e8607305fd69",
    "sourceType": "deposit",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": null,
    "billId": null,
    "date": "2026-07-10",
    "description": "Paycheck Rice Coffee Co",
    "amount": 1700,
    "kind": "income",
    "category": "Income",
    "status": "completed",
    "d": "Jul 10",
    "what": "Paycheck Rice Coffee Co",
    "amt": 1700,
    "cat": "Income",
    "k": "in"
  },
  {
    "id": "purchase:ded1dc6b-abf9-43e5-9dda-b1b6584b896b",
    "sourceId": "ded1dc6b-abf9-43e5-9dda-b1b6584b896b",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "61ea0a9e-859b-4d25-a02c-729ae72ff019",
    "billId": "8e90e7a4-6c0b-454a-b6a3-a6788c500e91",
    "date": "2026-07-10",
    "description": "Geico",
    "amount": -120,
    "kind": "bill",
    "category": "Car insurance",
    "status": "completed",
    "d": "Jul 10",
    "what": "Geico",
    "amt": -120,
    "cat": "Car insurance",
    "k": "rec"
  },
  {
    "id": "purchase:869c63d4-812f-425e-9cad-fd85e707b2f3",
    "sourceId": "869c63d4-812f-425e-9cad-fd85e707b2f3",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "13ba9d2c-026a-4d4f-a65d-358958b13467",
    "billId": null,
    "date": "2026-07-09",
    "description": "H-E-B",
    "amount": -168,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Jul 9",
    "what": "H-E-B",
    "amt": -168,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:a0813b8b-023d-4b46-803e-fb1019d76f1e",
    "sourceId": "a0813b8b-023d-4b46-803e-fb1019d76f1e",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "5fccf4f1-1c27-4ab5-997d-2d02d7f5c01d",
    "billId": null,
    "date": "2026-07-07",
    "description": "AMC Theatres",
    "amount": -33,
    "kind": "purchase",
    "category": "Fun & other",
    "status": "completed",
    "d": "Jul 7",
    "what": "AMC Theatres",
    "amt": -33,
    "cat": "Fun & other",
    "k": "ev"
  },
  {
    "id": "purchase:d8c08d7a-8ab4-460a-b6c4-d5ecb2638455",
    "sourceId": "d8c08d7a-8ab4-460a-b6c4-d5ecb2638455",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "01066957-62e7-4b41-bf2d-b2ff20c3f7f8",
    "billId": "1635cf93-a2e0-417d-8234-95ffe144c791",
    "date": "2026-07-06",
    "description": "Reliant Energy",
    "amount": -105,
    "kind": "bill",
    "category": "Electric",
    "status": "completed",
    "d": "Jul 6",
    "what": "Reliant Energy",
    "amt": -105,
    "cat": "Electric",
    "k": "rec"
  },
  {
    "id": "purchase:fdcfea06-dea8-41f5-ad4b-00bb6175bc52",
    "sourceId": "fdcfea06-dea8-41f5-ad4b-00bb6175bc52",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "37fc2442-45a4-4a9a-b77f-1890a009da0f",
    "billId": null,
    "date": "2026-07-06",
    "description": "Starbucks",
    "amount": -8,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Jul 6",
    "what": "Starbucks",
    "amt": -8,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:40f979dd-b876-4b8c-91f7-a34a83a841ea",
    "sourceId": "40f979dd-b876-4b8c-91f7-a34a83a841ea",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "24434a3e-6e67-4132-a6c9-189ea78a360b",
    "billId": "9d4c4ae3-52ec-41c5-9960-c8c5f7d0db9c",
    "date": "2026-07-05",
    "description": "Harbor Lofts",
    "amount": -1150,
    "kind": "bill",
    "category": "Rent",
    "status": "completed",
    "d": "Jul 5",
    "what": "Harbor Lofts",
    "amt": -1150,
    "cat": "Rent",
    "k": "rec"
  },
  {
    "id": "purchase:62ae079a-40e0-4c68-a8af-c029e11f1abd",
    "sourceId": "62ae079a-40e0-4c68-a8af-c029e11f1abd",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "8f219061-4af7-49b6-9686-d997a82ada4c",
    "billId": null,
    "date": "2026-07-05",
    "description": "Uber",
    "amount": -18,
    "kind": "purchase",
    "category": "Rides & transit",
    "status": "completed",
    "d": "Jul 5",
    "what": "Uber",
    "amt": -18,
    "cat": "Rides & transit",
    "k": "ev"
  },
  {
    "id": "purchase:4d6ff0f3-f3a3-4b04-a849-49da538bef26",
    "sourceId": "4d6ff0f3-f3a3-4b04-a849-49da538bef26",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "eade63ef-3cea-48a3-b259-12c6b277c37f",
    "billId": null,
    "date": "2026-07-04",
    "description": "Amazon",
    "amount": -48,
    "kind": "purchase",
    "category": "Household",
    "status": "completed",
    "d": "Jul 4",
    "what": "Amazon",
    "amt": -48,
    "cat": "Household",
    "k": "ev"
  },
  {
    "id": "purchase:2ec65780-9345-4c72-99ed-52c9a4f80126",
    "sourceId": "2ec65780-9345-4c72-99ed-52c9a4f80126",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "946e0464-3261-4555-85a3-bb8c9d096e00",
    "billId": null,
    "date": "2026-07-03",
    "description": "Kroger",
    "amount": -142,
    "kind": "purchase",
    "category": "Groceries",
    "status": "completed",
    "d": "Jul 3",
    "what": "Kroger",
    "amt": -142,
    "cat": "Groceries",
    "k": "ev"
  },
  {
    "id": "purchase:50b62b39-06e1-427f-8546-64e366807191",
    "sourceId": "50b62b39-06e1-427f-8546-64e366807191",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "ddffc10e-4157-4667-bc5c-e262ea13282d",
    "billId": "c0cdb1dd-0ff0-4dbb-a9e3-cd5fe9a18d11",
    "date": "2026-07-03",
    "description": "Plexi",
    "amount": -30,
    "kind": "bill",
    "category": "Streaming",
    "status": "completed",
    "d": "Jul 3",
    "what": "Plexi",
    "amt": -30,
    "cat": "Streaming",
    "k": "rec"
  },
  {
    "id": "purchase:d3ce74bd-3a49-46f1-8c0f-951cc0c61bad",
    "sourceId": "d3ce74bd-3a49-46f1-8c0f-951cc0c61bad",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "c2b5d60e-e99c-4543-a4a4-963550180589",
    "billId": null,
    "date": "2026-07-02",
    "description": "Chipotle",
    "amount": -16,
    "kind": "purchase",
    "category": "Dining & takeout",
    "status": "completed",
    "d": "Jul 2",
    "what": "Chipotle",
    "amt": -16,
    "cat": "Dining & takeout",
    "k": "ev"
  },
  {
    "id": "purchase:8db42e9c-b823-4257-b7c1-d4de0090f5ca",
    "sourceId": "8db42e9c-b823-4257-b7c1-d4de0090f5ca",
    "sourceType": "purchase",
    "accountId": "c9f79f65-2964-4332-97dc-85a12c108609",
    "merchantId": "3beb7b2d-444b-49b4-8876-927a855b27c7",
    "billId": "195606fd-55de-441a-b5e5-b2bc7a46b9e8",
    "date": "2026-07-01",
    "description": "Northline Internet",
    "amount": -65,
    "kind": "bill",
    "category": "Internet",
    "status": "completed",
    "d": "Jul 1",
    "what": "Northline Internet",
    "amt": -65,
    "cat": "Internet",
    "k": "rec"
  }
];

export const notice = "From: Northline Internet <billing@northline.example>\nTo: alex.rivera@example.com\nDate: Fri, 25 Sep 2026 09:12:04 -0500\nSubject: Your October bill\n\nHi Alex,\n\nYour Internet 300 plan will renew at $90.00 starting with your October 1 bill.\nYour 12-month promotional credit of $25.00 ended on September 30.\nYour speed and service are unchanged.\n\nQuestions? Visit support.northline.example or call the number on your bill.\n\nNorthline Internet\nAccount ending 4417\n";
>>>>>>> Stashed changes:data/household.sample.js
