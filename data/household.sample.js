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
      "cancellable": false,
      "change": {
        "to": 90,
        "effective": "2026-10-01",
        "why": "Promotional credit ended",
        "credit": 25,
        "evidence": [
          "renew at $90.00 starting with your October 1 bill",
          "promotional credit of $25.00 ended"
        ],
        "support": "support.northline.example",
        "account": "4417",
        "sender": "Northline Internet",
        "source": "notice",
        "increase": 25
      }
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
    "left": 4,
    "planned": 300,
    "months": [
      "Oct 2",
      "Nov 2",
      "Dec 2",
      "Jan 2"
    ]
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
