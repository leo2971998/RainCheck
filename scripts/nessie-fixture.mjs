// Synthetic test household, deliberately separate from the published Alex Rivera demo.
// Whole dollars match the deployed Nessie sandbox's storage behavior.
export function buildFixture() {
  const asOf = '2026-09-28', namespace = 'RC Backend V1';
  const accounts = [
    { key: 'checking', type: 'Checking', nickname: `${namespace} Checking`, openingBalance: 4000 },
    { key: 'emergency', type: 'Savings', nickname: `${namespace} Emergency`, openingBalance: 500 },
    { key: 'travel', type: 'Savings', nickname: `${namespace} Travel`, openingBalance: 100 },
  ];
  const merchants = [
    ['grocer-a', 'Bayou Market', 'Groceries'], ['grocer-b', 'Oak Street Grocery', 'Groceries'],
    ['cafe', 'Morning Cafe', 'Dining & takeout'], ['dining', 'Neighborhood Kitchen', 'Dining & takeout'],
    ['transit', 'City Transit', 'Rides & transit'], ['rides', 'Local Rides', 'Rides & transit'],
    ['home', 'Home Store', 'Household'], ['books', 'Book Corner', 'Fun & other'],
    ['cinema', 'Movie House', 'Fun & other'], ['pharmacy', 'Community Pharmacy', 'Household'],
    ['rent', 'Bayou Apartments', 'Rent'], ['internet', 'Bayou Internet', 'Utilities'],
    ['electric', 'Bayou Electric', 'Utilities'], ['phone', 'Mobile Plan', 'Telecom'],
    ['insurance', 'Auto Cover', 'Insurance'], ['streaming', 'Movie Stream', 'Entertainment'],
    ['gym', 'Neighborhood Gym', 'Fitness'], ['music', 'Music Club', 'Entertainment'],
  ].map(([key, name, category]) => ({ key, name: `${namespace} ${name}`, category }));
  const bills = [
    ['rent', 5, 1150], ['internet', 1, 65], ['electric', 6, 110], ['phone', 12, 45],
    ['insurance', 10, 120], ['streaming', 3, 30], ['gym', 15, 40],
  ].map(([key, day, amount]) => ({ key, merchant: key, day, amount, label: key[0].toUpperCase() + key.slice(1) }));
  const records = [];
  const add = (key, account, type, date, amount, description, links = {}) =>
    records.push({ key, account, type, date, amount, description, ...links });
  for (let month = 0; month < 12; month++) {
    const base = new Date(Date.UTC(2025, 9 + month, 1));
    const ym = base.toISOString().slice(0, 7);
    const date = day => `${ym}-${String(day).padStart(2, '0')}`;
    // Weekly-ish groceries and dining; several merchants per spending category.
    for (let week = 0; week < 4; week++) {
      add(`${ym}-groceries-${week}`, 'checking', 'purchase', date(2 + 7 * week), 110 + (month * 7 + week * 11) % 35, 'Grocery shop', { merchant: week % 2 ? 'grocer-a' : 'grocer-b' });
      add(`${ym}-cafe-${week}`, 'checking', 'purchase', date(3 + 7 * week), 8 + week, 'Cafe visit', { merchant: 'cafe' });
      add(`${ym}-dining-${week}`, 'checking', 'purchase', date(4 + 7 * week), 22 + (month + week) % 12, 'Dinner', { merchant: 'dining' });
      add(`${ym}-transit-${week}`, 'checking', 'purchase', date(5 + 7 * week), 12 + week * 2, 'Ride or transit', { merchant: week % 2 ? 'rides' : 'transit' });
    }
    for (const [merchant, day, amount] of [['home', 8, 70 + month], ['books', 11, 22], ['cinema', 17, 30], ['pharmacy', 19, 24], ['music', 20, 12]])
      add(`${ym}-${merchant}`, 'checking', 'purchase', date(day), amount, `${merchant} purchase`, { merchant });
    for (const bill of bills)
      add(`${ym}-bill-${bill.key}`, 'checking', 'purchase', date(bill.day), bill.amount + (bill.key === 'electric' && month === 11 ? 18 : 0), `${bill.label} payment`, { merchant: bill.merchant, bill: bill.key });
    for (const [destination, amount] of [['emergency', 150], ['travel', 50]]) {
      const transfer = `${ym}-${destination}`;
      add(`${transfer}-out`, 'checking', 'withdrawal', date(25), amount, `Transfer to ${destination}`, { transfer, counterpartAccount: destination });
      add(`${transfer}-in`, destination, 'deposit', date(25), amount, 'Transfer from checking', { transfer, counterpartAccount: 'checking' });
    }
    add(`${ym}-cash`, 'checking', 'withdrawal', date(18), 40, 'ATM cash withdrawal');
    if (month % 3 === 1) add(`${ym}-refund`, 'checking', 'deposit', date(23), 35, 'Refund for returned household item', { refundOf: `${ym}-home` });
  }
  for (let date = new Date('2025-10-03T00:00:00Z'); date.toISOString().slice(0, 10) <= asOf; date.setUTCDate(date.getUTCDate() + 14)) {
    const key = date.toISOString().slice(0, 10);
    add(`payroll-${key}`, 'checking', 'deposit', key, key >= '2026-08-01' ? 1800 : 1700, 'Payroll Bayou Design Co');
  }
  for (const a of accounts) a.balance = a.openingBalance + records.filter(r => r.account === a.key)
    .reduce((sum, r) => sum + (r.type === 'deposit' ? r.amount : -r.amount), 0);
  return { version: 1, namespace, asOf, customer: { first_name: 'RainCheck', last_name: 'Backend V1' }, accounts, merchants, bills, records };
}
