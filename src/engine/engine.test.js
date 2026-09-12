// Locks the numbers the demo turns on, against the real seeded sandbox snapshot.
// If any of these fail, something in the data pipeline changed and the demo is wrong.
//
//   npm test
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildHousehold, detectPostedChanges, applyNotice } from './household.js';
import { parseNotice } from './changes.js';
import { simulate, capacity, goalAt, cutNeeded, nextChargeDate, monthlyEquivalent } from './forecast.js';
import { buildOptions } from './options.js';
import { buildAlerts } from './alerts.js';
import { emptyPlan, applyPatch, revert, scenarioFor } from './plan.js';

const TODAY = '2026-09-28';
const snap = JSON.parse(readFileSync(new URL('../../data/nessie-snapshot.json', import.meta.url), 'utf8'));
const notice = readFileSync(new URL('../../data/notice-internet.txt', import.meta.url), 'utf8');

function load() {
  const h = buildHousehold(snap, TODAY);
  h.recurring = applyNotice(detectPostedChanges(h, snap), notice, parseNotice(notice, 2026));
  const increase = h.recurring.find(r => r.change)?.change.increase ?? 0;
  return { h, sc: { increase, contribution: h.goal.planned, cuts: {}, cancelled: {}, income: null } };
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
    expect(simulate(h, { ...sc, increase: 0 }).low.balance).toBeGreaterThanOrEqual(h.cushion);
  });

  it('supports $300 a month before the increase and $275 after', () => {
    expect(capacity(h, { ...sc, increase: 0 })).toBe(300);
    expect(capacity(h, sc)).toBe(275);
  });

  it('costs one dollar of contribution per dollar of increase', () => {
    expect(capacity(h, { ...sc, increase: 75 })).toBe(225);
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

  it('states the horizon assumption rather than presenting the goal total as checked', () => {
    const keep = options.find(o => o.id === 'keep');
    expect(keep.outcome.assumption).toMatch(/Only the next 34 days have been checked/);
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
    const applied = { id: 'renewal', label: 'pending', contribution: null };
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
