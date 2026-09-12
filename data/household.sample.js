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

