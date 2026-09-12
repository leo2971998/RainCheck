// Locks the numbers the demo turns on, against the real seeded sandbox snapshot.
// If any of these fail, something in the data pipeline changed and the demo is wrong.
//
//   npm test
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildHousehold, detectPostedChanges, applyNotice } from './household.js';
import { parseNotice, reviewNotice } from './changes.js';
import { simulate, capacity, goalAt, cutNeeded, nextChargeDate, monthlyEquivalent, goalPlan, scheduleUntil, validatePlan, dateToReach } from './forecast.js';
import { buildOptions } from './options.js';
import { buildAlerts } from './alerts.js';
import { emptyPlan, applyPatch, revert, scenarioFor, householdFor } from './plan.js';
import { discoverCommitments } from './discover.js';

const TODAY = '2026-09-28';
const snap = JSON.parse(readFileSync(new URL('../../data/nessie-snapshot.json', import.meta.url), 'utf8'));
const notice = readFileSync(new URL('../../data/notice-internet.txt', import.meta.url), 'utf8');

function load() {
  const h = buildHousehold(snap, TODAY);
  h.recurring = applyNotice(detectPostedChanges(h, snap), notice, parseNotice(notice, 2026));
  return { h, sc: { contribution: h.goal.planned, cuts: {}, cancelled: {}, whatIf: {}, treatAsNewPrice: {}, income: null } };
}

/**
 * The household as the app now presents it: the bank's records, with NO notice applied. A provider
 * notice is not in a bank's transaction history, so it only exists once the user accepts it.
 */
function loadPlain() {
  const h = buildHousehold(snap, TODAY);
  h.recurring = detectPostedChanges(h, snap);
  return { h, sc: { contribution: h.goal.planned, cuts: {}, cancelled: {}, whatIf: {}, treatAsNewPrice: {}, income: null } };
}

/** A scenario where one bill is held at a given amount — the per-bill replacement for the old
 *  scenario-wide `increase`. Passing the bill's current amount means "as if it had not changed". */
function holdAt(sc, billId, amount) {
  return { ...sc, whatIf: { ...sc.whatIf, [billId]: amount } };
}

describe('reading the bank records', () => {
  const { h } = load();

  it('learns the five spending categories, and no phantom ones', () => {
    expect(Object.fromEntries(h.allowances.map(a => [a.label, a.monthly]))).toEqual({
      'Groceries': 700, 'Fun & other': 300, 'Household': 260, 'Dining & takeout': 180, 'Rides & transit': 60,
    });
  });

  // The bug this guards: every bill also posts as a purchase. Counting both doubles daily
  // spending and sends the forecast hundreds of dollars under.
  it('does not turn a bill into a spending category', () => {
    for (const bill of h.recurring) expect(h.allowances.some(a => a.label === bill.label)).toBe(false);
    expect(h.allowances.some(a => /rent|utilities|insurance|telecom|fitness/i.test(a.label))).toBe(false);
  });

  it('projects the paycheck cadence and calls every projection estimated', () => {
    expect(h.income.map(p => p.date)).toEqual(['2026-10-02', '2026-10-16', '2026-10-30']);
    // Being next in an inferred sequence is not confirmation. Labelling one "confirmed" made the
    // forecast look better evidenced than it is.
    expect(h.income.map(p => p.status)).toEqual(['estimated', 'estimated', 'estimated']);
  });

  it('infers how often a commitment posts instead of assuming monthly', () => {
    for (const r of h.recurring) expect(r.everyMonths).toBe(1);      // this household is all monthly
    expect(h.recurring.every(r => r.freq === 'Monthly')).toBe(true);
  });
});

describe('detecting what changed', () => {
  const { h } = load();

  it('reads the increase out of the notice, with quotable evidence', () => {
    const internet = h.recurring.find(r => r.change);
    expect(internet.label).toBe('Internet');
    expect(internet.change).toMatchObject({ to: 90, effective: '2026-10-01', increase: 25, why: 'Promotional credit ended' });
    for (const phrase of internet.change.evidence) expect(notice).toContain(phrase);
  });

  // A higher charge is not a price change. Only a notice can establish that.
  it('flags the electric charge as unexplained, not as a new price', () => {
    const electric = h.recurring.find(r => r.unexplained);
    expect(electric.label).toBe('Electric');
    expect(electric.lastPosted).toBe(128);
    expect(electric.change).toBeUndefined();
  });
});

describe('the forecast', () => {
  const { h, sc } = load();

  it('spreads everyday spending at $50 a day', () => {
    expect(simulate(h, sc).dailySpend).toBe(50);
  });

  it('finds the tight day: Oct 15 at $175, below the $200 cushion', () => {
    const sim = simulate(h, sc);
    expect(sim.low.key).toBe('2026-10-15');
    expect(Math.round(sim.low.balance)).toBe(175);
    expect(sim.worst).toBe('below');
  });

  it('holds above the cushion without the increase', () => {
    const internet = h.recurring.find(r => r.id === 'internet');
    expect(simulate(h, holdAt(sc, 'internet', internet.amount)).low.balance).toBeGreaterThanOrEqual(h.cushion);
  });

  it('supports $300 a month before the increase and $275 after', () => {
    const internet = h.recurring.find(r => r.id === 'internet');
    expect(capacity(h, holdAt(sc, 'internet', internet.amount))).toBe(300);
    expect(capacity(h, sc)).toBe(275);
  });

  it('costs one dollar of contribution per dollar of increase', () => {
    const internet = h.recurring.find(r => r.id === 'internet');
    expect(capacity(h, holdAt(sc, 'internet', internet.amount + 75))).toBe(225);
  });
});

describe('the consequence for the goal', () => {
  const { h, sc } = load();

  it('lands at $1,900, which is $100 short, one month later', () => {
    expect(goalAt(h, capacity(h, sc))).toMatchObject({ projected: 1900, gap: 100, monthsNeeded: 5 });
  });
});

describe('the options offered', () => {
  const { h, sc } = load();
  const cap = capacity(h, sc);
  const options = buildOptions(h, sc, cap, { groceries: true });

  // Not $25: a monthly cut only partly lands before the tight day, so the search finds the real number.
  it('asks for a $45 dining trim to restore the $300 plan, not $25', () => {
    expect(cutNeeded(h, sc, 'dining-takeout', 300)).toBe(45);
  });

  it('offers four responses and never one that raids savings', () => {
    expect(options.map(o => o.id)).toEqual(['keep', 'reduce', 'renewal', 'date']);
    expect(options.some(o => /savings|transfer/i.test(o.title))).toBe(false);
  });

  // Every option is measured the same three ways, so the comparison is like for like. Putting a
  // dining allowance beside a savings contribution compares different things without lying.
  it('reports the same outcomes for every option', () => {
    for (const o of options.filter(x => !x.disabled))
      expect(Object.keys(o.outcome)).toEqual(expect.arrayContaining(
        ['contribution', 'low', 'meetsCushion', 'goalProjected', 'goalGap', 'assumption']));
  });

  it('derives every claim from a simulation, so an edited goal cannot be mislabelled', () => {
    const bigger = { ...h, goal: { ...h.goal, target: 5000 } };
    const trim = buildOptions(bigger, sc, capacity(bigger, sc), { groceries: true }).find(o => o.id === 'reduce');
    // $800 saved plus four $300 contributions is $2,000, nowhere near $5,000.
    expect(trim.outcome.goalProjected).toBe(2000);
    expect(trim.outcome.onTarget).toBe(false);
    expect(trim.outcome.goalGap).toBe(3000);
  });

  it('leaves a protected allowance alone', () => {
    const protectedAll = buildOptions(h, sc, cap, Object.fromEntries(h.allowances.map(a => [a.id, true])));
    expect(protectedAll.find(o => o.id === 'reduce').disabled).toBe(true);
  });

  it('every option actually delivers what it claims', () => {
    for (const o of options) {
      if (o.conditional || o.disabled) continue;     // a cancellation is a scenario, not a fact
      const after = { ...sc, ...o.apply, cuts: { ...sc.cuts, ...(o.apply.cuts || {}) } };
      expect(simulate(h, after).low.balance).toBeGreaterThanOrEqual(h.cushion);
    }
  });

  // This used to say only the next 34 days had been checked, because that was true: one window's
  // affordable contribution was multiplied across later months. It is now checked to the goal date.
  it('states how far the plan has actually been checked', () => {
    const keep = options.find(o => o.id === 'keep');
    // Stated as a person would say it, and it must name the horizon actually simulated, not a window.
    expect(keep.outcome.assumption).toMatch(/Checked against every bill and paycheck through \w+ \d+, 202\d/);
    expect(keep.outcome.checkedThrough <= h.goal.targetDate).toBe(true);    // the last contribution, not beyond
    expect(keep.outcome.horizonDays).toBeGreaterThan(h.windowDays * 2);     // far past one window
  });
});

describe('a cancellation nobody has confirmed', () => {
  const { h, sc } = load();
  const cap = capacity(h, sc);
  const renewal = buildOptions(h, sc, cap, { groceries: true }).find(o => o.id === 'renewal');

  it('is offered as conditional, and records an intention rather than a result', () => {
    expect(renewal.conditional).toBe(true);
    expect(renewal.apply.pendingCancel).toBeTruthy();
    expect(renewal.apply.cancelled).toBeUndefined();
  });

  // The app must not solve a money problem by assuming a provider did what they were asked.
  it('does not improve the real forecast when applied', () => {
    const before = simulate(h, sc).low.balance;
    const after = simulate(h, { ...sc, pendingCancel: renewal.apply.pendingCancel }).low.balance;
    expect(after).toBe(before);
  });

  it('improves it only once the user confirms it actually happened', () => {
    const confirmed = simulate(h, { ...sc, cancelled: renewal.apply.pendingCancel }).low.balance;
    expect(confirmed).toBeGreaterThan(simulate(h, sc).low.balance);
  });
});

describe('the contribution schedule', () => {
  const { h, sc } = load();

  it('always lists exactly as many dates as the goal has contributions', () => {
    for (const left of [1, 4, 5, 9]) {
      const g = goalAt(h, 275, left);
      expect(g.schedule).toHaveLength(left);
      expect(g.left).toBe(left);
    }
  });

  it('puts contributions a month apart, not 30 days apart', () => {
    expect(goalAt(h, 275, 4).schedule).toEqual(['2026-10-02', '2026-11-02', '2026-12-02', '2027-01-02']);
  });

});

describe('alerts', () => {
  const { h, sc } = load();
  const cap = capacity(h, sc);
  const alertsFor = (scenario, applied = null) => buildAlerts(h, scenario, simulate(h, scenario), capacity(h, scenario), applied);

  it('raises one alert for the notice increase, folding the cushion dip into it', () => {
    const out = alertsFor(sc);
    expect(out.filter(a => a.id.startsWith('increase:'))).toHaveLength(1);
    expect(out.some(a => a.id === 'cushion')).toBe(false);          // one event, one alert
    expect(out[0].body).toMatch(/below your \$200 cushion/);
    expect(out[0].body).toMatch(/\$100 short/);
  });

  // The gap this covers: a charge that simply arrived higher used to raise nothing at all.
  it('raises a separate alert for a charge that posted higher with no explanation', () => {
    const out = alertsFor(sc);
    const unexplained = out.find(a => a.id === 'unexplained:electric');
    expect(unexplained).toBeTruthy();
    expect(unexplained.title).toContain('$20 higher than usual');
    expect(unexplained.body).toContain("$108");   // the gap and the usual must add up on screen
    expect(unexplained.body).toMatch(/We have not confirmed why/);
    expect(unexplained.actions[0].target).toBe('page:recurring');
  });

  it('never calls an unexplained charge a price change', () => {
    const unexplained = alertsFor(sc).find(a => a.id === 'unexplained:electric');
    expect(unexplained.title).not.toMatch(/increase|price change/i);
  });

  it('clears the unexplained alert once the user decides, either way', () => {
    for (const decision of [true, false])
      expect(alertsFor({ ...sc, treatAsNewPrice: { electric: decision } }).some(a => a.id.startsWith('unexplained:'))).toBe(false);
  });

  it('warns what it would cost if the higher charge is the new price', () => {
    const unexplained = alertsFor(sc).find(a => a.id === 'unexplained:electric');
    const ifNew = capacity(h, { ...sc, treatAsNewPrice: { electric: true } });
    expect(ifNew).toBeLessThan(cap);
    expect(unexplained.body).toContain(`$${ifNew} a month`);
  });

  it('raises the cushion alert on its own when nothing else explains it', () => {
    const noNotice = { ...h, recurring: h.recurring.map(({ change, ...r }) => r) };
    const scenario = { ...sc, increase: 0, contribution: 400 };
    const out = buildAlerts(noNotice, scenario, simulate(noNotice, scenario), capacity(noNotice, scenario), null);
    expect(out.some(a => a.id === 'cushion')).toBe(true);
  });

  it('confirms an applied plan and says nothing moved', () => {
    const out = alertsFor(sc, { id: 'keep', label: 'Plan set to $275/month' });
    const done = out.find(a => a.id === 'applied');
    expect(done.tone).toBe('good');
    expect(done.body).toMatch(/Nothing was transferred/);
  });
});

describe('commitments that are not monthly', () => {
  const { h } = load();
  const annual = { id: 'domain', label: 'Domain renewal', amount: 240, day: 20, everyMonths: 12, anchor: '2026-03-20' };

  it('does not report an annual renewal as due next month', () => {
    expect(nextChargeDate(annual, '2026-09-28')).toBe('2027-03-20');
    expect(nextChargeDate({ ...annual, everyMonths: 1 }, '2026-09-28')).toBe('2026-10-20');
  });

  it('counts an annual charge at its monthly equivalent, not its full amount', () => {
    expect(monthlyEquivalent(annual)).toBe(20);
    expect(monthlyEquivalent(h.recurring[0])).toBe(h.recurring[0].amount);
  });

  it('leaves an annual charge out of a forecast window it does not fall in', () => {
    const withAnnual = { ...h, recurring: [...h.recurring, annual] };
    const plain = simulate(h, { increase: 25, contribution: 300 });
    const extra = simulate(withAnnual, { increase: 25, contribution: 300 });
    expect(extra.low.balance).toBe(plain.low.balance);
  });
});

describe('keeping the plans apart', () => {
  const { h, sc } = load();
  const cap = capacity(h, sc);

  // Accepting an option that only records an intention must not change what the goal reports.
  // It used to flip "$100 short" to "On track" on the strength of a contribution nobody could afford.
  it('a pending cancellation does not change the goal result', () => {
    const beforeAccepting = goalAt(h, cap);
    const applied = { contribution: null };
    const afterAccepting = goalAt(h, applied.contribution ?? cap);
    expect(afterAccepting.projected).toBe(beforeAccepting.projected);
    expect(afterAccepting.gap).toBe(100);
  });

  it('an accepted contribution is what the goal reports', () => {
    const applied = { id: 'reduce', contribution: 300 };
    expect(goalAt(h, applied.contribution ?? cap).projected).toBe(2000);
  });

  it('the schedule, the count and the chart all read the same goal', () => {
    const g = goalAt(h, cap, 5);
    expect(g.schedule).toHaveLength(g.left);
    expect(g.contribution).toBe(cap);
    expect(g.projected).toBe(h.goal.saved + 5 * cap);
  });
});

describe('decisions stay independent of one another', () => {
  const { h } = load();
  const start = emptyPlan(h);

  // Applying one thing used to silently replace another, because the last action WAS the plan.
  it('recording a pending cancellation leaves an accepted goal extension alone', () => {
    const extended = applyPatch(start, { goalLeft: 5, contribution: 275 }, 'extended').plan;
    const after = applyPatch(extended, { pendingCancel: { gym: true } }, 'pending').plan;
    expect(after.goalLeft).toBe(5);
    expect(after.contribution).toBe(275);
  });

  it('applying an extension after editing the goal keeps both', () => {
    const edited = applyPatch(start, { goalTarget: 5000, goalLeft: 4 }, 'edited').plan;
    const extended = applyPatch(edited, { goalLeft: 16, contribution: 275 }, 'extended').plan;
    expect(extended).toMatchObject({ goalTarget: 5000, goalLeft: 16, contribution: 275 });
  });

  it('undo reverses one change and nothing else, in either order', () => {
    const a = applyPatch(start, { contribution: 275 }, 'contribution');
    const b = applyPatch(a.plan, { treatAsNewPrice: { electric: true } }, 'electric');
    const undoneElectric = revert(b.plan, b.entry);
    expect(undoneElectric.contribution).toBe(275);          // the earlier decision survives
    expect(undoneElectric.treatAsNewPrice.electric).toBeUndefined();
    const undoneBoth = revert(undoneElectric, a.entry);
    expect(undoneBoth.contribution).toBeNull();
  });

  it('merged fields accumulate rather than replace', () => {
    const one = applyPatch(start, { cuts: { 'dining-takeout': 45 } }, 'trim').plan;
    const two = applyPatch(one, { cuts: { 'fun-other': 20 } }, 'trim2').plan;
    expect(two.cuts).toEqual({ 'dining-takeout': 45, 'fun-other': 20 });
  });

  it('the goal reads the accepted contribution, and the affordable one otherwise', () => {
    const cap = capacity(h, scenarioFor(h, start));
    expect(goalAt(h, start.contribution ?? cap).contribution).toBe(cap);
    const accepted = applyPatch(start, { contribution: 300 }, 'x').plan;
    expect(goalAt(h, accepted.contribution ?? cap).contribution).toBe(300);
  });
});

describe('importing a notice the user pasted', () => {
  const { h, sc } = load();
  const base = { ...h };
  const GYM_NOTICE = [
    'From: Fit24 Memberships <billing@fit24.example>', '',
    'Your membership will renew at $55.00 starting with your October 15 bill.',
  ].join('\n');

  it('reads the amount and date, and names the commitment it belongs to', () => {
    const r = reviewNotice(GYM_NOTICE, h.recurring, 2026);
    expect(r.suggested.label).toBe('Gym');
    expect(r.change).toMatchObject({ to: 55, effective: '2026-10-15' });
    expect(r.problems).toHaveLength(0);
  });

  it('refuses to guess when the notice names no commitment', () => {
    const r = reviewNotice('From: Someone\n\nYour plan will renew at $99.00 starting with your December 1 bill.', h.recurring, 2026);
    expect(r.suggested).toBeNull();
    expect(r.problems[0]).toMatch(/does not clearly name/);
  });

  it('says so when there is nothing it can read', () => {
    const r = reviewNotice('Hello, nothing financial here.', h.recurring, 2026);
    expect(r.change).toBeNull();
    expect(r.problems[0]).toMatch(/No renewal amount and date/);
  });

  // Two commitments can change at once; there is no longer one scenario-wide increase.
  it('carries a second imported change alongside the first', () => {
    const r = reviewNotice(GYM_NOTICE, h.recurring, 2026);
    const plan = applyPatch(emptyPlan(), { billChanges: { gym: { ...r.change, increase: 15 } } }, 'gym').plan;
    const after = householdFor(base, plan);
    expect(after.recurring.filter(x => x.change).map(x => x.label).sort()).toEqual(['Gym', 'Internet']);
    expect(capacity(after, scenarioFor(after, plan))).toBeLessThan(capacity(h, sc));
  });

  it('replaces rather than stacks when the same bill is imported twice', () => {
    const one = applyPatch(emptyPlan(), { billChanges: { gym: { to: 55, effective: '2026-10-15' } } }, 'a').plan;
    const two = applyPatch(one, { billChanges: { gym: { to: 60, effective: '2026-10-15' } } }, 'b').plan;
    expect(two.billChanges.gym.to).toBe(60);
    expect(householdFor(base, two).recurring.find(r => r.id === 'gym').change.to).toBe(60);
  });

  it('a what-if moves only the bill it was typed against', () => {
    const plan = applyPatch(emptyPlan(), { whatIf: { internet: 150 } }, 'w').plan;
    const after = householdFor(base, plan);
    const day = simulate(after, scenarioFor(after, plan)).days.find(d => d.key === '2026-10-01');
    expect(day.events.find(e => e.id === 'internet').amt).toBe(-150);
    expect(day.events.find(e => e.id === 'streaming')).toBeUndefined();   // not due that day
  });
});

describe('decisions survive a reload', () => {
  const { h } = load();

  // JSON.stringify drops keys whose value is undefined, so a history entry saying "this key did
  // not exist before" came back from localStorage saying nothing at all — and Undo then left a
  // first cancellation or imported change in place.
  it('reverses a newly added key after the history has been through JSON', () => {
    const step = applyPatch(emptyPlan(), { pendingCancel: { gym: true } }, 'pending');
    const reloaded = JSON.parse(JSON.stringify(step.entry));
    expect(revert(step.plan, reloaded).pendingCancel).toEqual({});
  });

  it('restores a previous value, rather than deleting it, when one existed', () => {
    const first = applyPatch(emptyPlan(), { cuts: { 'dining-takeout': 45 } }, 'a');
    const second = applyPatch(first.plan, { cuts: { 'dining-takeout': 80 } }, 'b');
    const reloaded = JSON.parse(JSON.stringify(second.entry));
    expect(revert(second.plan, reloaded).cuts).toEqual({ 'dining-takeout': 45 });
  });

  it('reverses a scalar that had no earlier value', () => {
    const step = applyPatch(emptyPlan(), { goalTarget: 5000 }, 'goal');
    const reloaded = JSON.parse(JSON.stringify(step.entry));
    expect(revert(step.plan, reloaded).goalTarget).toBeNull();
  });
});

describe('adopting a discovered commitment', () => {
  const { h } = load();
  const found = discoverCommitments(snap, h)[0];

  it('says which spending category the charges are currently counted in', () => {
    expect(found.categoryId).toBeTruthy();
    expect(h.allowances.some(a => a.id === found.categoryId)).toBe(true);
    expect(found.monthlyShare).toBeGreaterThan(0);
  });

  // The charges were already inside an allowance, because they were purchases. Adding the
  // commitment without taking them back out invents an expense the user never incurred.
  it('takes its share back out of that allowance, so nothing is counted twice', () => {
    const plan = applyPatch(emptyPlan(), { adopted: { [found.id]: found } }, 'adopt').plan;
    const after = householdFor(h, plan);
    const before = h.allowances.find(a => a.id === found.categoryId).monthly;
    const now = after.allowances.find(a => a.id === found.categoryId).monthly;
    expect(now).toBe(before - found.monthlyShare);
    expect(after.recurring.some(r => r.id === found.id)).toBe(true);
  });

  it('leaves the total monthly outgoing unchanged by the adoption itself', () => {
    const plan = applyPatch(emptyPlan(), { adopted: { [found.id]: found } }, 'adopt').plan;
    const after = householdFor(h, plan);
    const spendBefore = h.allowances.reduce((a, x) => a + x.monthly, 0);
    const spendAfter = after.allowances.reduce((a, x) => a + x.monthly, 0) + found.amount;
    expect(Math.abs(spendAfter - spendBefore)).toBeLessThanOrEqual(1);   // rounding only
  });
});

describe('a goal stated as an amount by a date', () => {
  const { h, sc } = loadPlain();          // before any notice is accepted
  const GOAL = { target: 2000, targetDate: '2027-01-31', saved: 800 };

  it('turns the date into the contributions it implies', () => {
    expect(scheduleUntil(h, '2027-01-31')).toEqual(['2026-10-02', '2026-11-02', '2026-12-02', '2027-01-02']);
  });

  it('separates what the date asks for from what the plan can carry', () => {
    const g = goalPlan(h, sc, GOAL);
    expect(g.required).toBe(300);          // (2000 - 800) / 4
    expect(g.supported).toBe(300);         // and this household can carry it, before the increase
    expect(g.feasible).toBe(true);
  });

  // The old capacity() proved one 34-day window and the goal total multiplied it across months.
  // This checks every contribution against the bills and paychecks that actually fall around it.
  it('checks the contribution across the whole goal, not one window', () => {
    const g = goalPlan(h, sc, GOAL);
    expect(g.horizonDays).toBeGreaterThan(h.windowDays * 2);
    expect(g.checkedThrough).toBe('2027-01-31');
    expect(validatePlan(h, sc, { contribution: g.supported, schedule: g.schedule }).ok).toBe(true);
  });

  it('reports a contribution the horizon cannot carry as not fitting', () => {
    const g = goalPlan(h, sc, { ...GOAL, contribution: 600 });
    expect(g.fits).toBe(false);
    expect(g.low.balance).toBeLessThan(h.cushion);
  });

  it('offers the date the current spending actually reaches', () => {
    const g = goalPlan(h, sc, GOAL);
    const reach = dateToReach(h, sc, { target: 2000, saved: 800, contribution: g.supported });
    expect(reach.months).toBe(4);
    expect(reach.date).toBe('2027-01-02');
  });

  it('becomes infeasible once a bill increase is accepted, and says by how much', () => {
    const change = parseNotice(notice, 2026);
    const plan = applyPatch(emptyPlan(), { billChanges: { internet: { ...change, increase: 25 } } }, 'accept').plan;
    // h here is the plain household, so accepting the notice is the ONLY change applied.
    const after = householdFor(h, plan);
    const g = goalPlan(after, scenarioFor(after, plan), GOAL);
    expect(g.supported).toBe(275);
    expect(g.feasible).toBe(false);
    expect(g.gap).toBe(100);
    // …and the other path: keep the spending, move the date.
    expect(dateToReach(after, scenarioFor(after, plan), { target: 2000, saved: 800, contribution: 275 }).months).toBe(5);
  });
});
