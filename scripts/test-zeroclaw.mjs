// Read the local sandbox adapter, calculate with the existing engine, then send
// only aggregate facts through SSH stdin. Credentials stay on the Linux server.
// --public tests the public IP with verified HTTPS/SNI after Nginx activation.
import { spawn } from 'node:child_process';
import { budgetImpact, readSubscription, subscriptionPatch } from '../src/engine/budget.js';
import { emptyPlan } from '../src/engine/plan.js';

const response = await fetch('http://127.0.0.1:5176/api/household?dataset=demo', { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error('Start the local RainCheck sandbox server first.');
const payload = await response.json();
if (payload.dataset !== 'demo' || !payload.household) throw new Error('Expected the synthetic Nessie demo dataset.');
const base = payload.household;
const subscription = readSubscription({ label: 'Review test subscription', amount: '75', startsOn: base.today }, base.today);
const impact = budgetImpact(base, emptyPlan(), subscriptionPatch('sub-review-test', subscription));
const cents = value => {
  if (!Number.isFinite(value)) throw new Error('The calculator did not return a usable numeric fact.');
  return Math.round(value * 100);
};
const outcome = value => ({ lowCents: cents(value.low), monthlyBillsCents: cents(value.monthlyBills),
  goalTargetCents: cents(value.target), goalProjectedCents: cents(value.projected),
  contributionCents: cents(value.contribution), goalDate: value.targetDate,
  contributionFits: value.fits, goalFeasible: value.feasible, checkedThrough: value.checkedThrough });
const brief = { version: 1, source: 'nessie-demo', asOf: impact.asOf, kind: 'subscription',
  windowDays: impact.windowDays, cushionCents: cents(impact.cushion),
  before: outcome(impact.before), after: outcome(impact.after) };
const remote = 'python3 /home/leo29798/raincheck-review/smoke.py' + (process.argv.includes('--public') ? ' --public' : '');
const child = spawn('ssh', ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5',
  '-o', 'StrictHostKeyChecking=yes', 'poketeam', remote], { shell: false, windowsHide: true, stdio: ['pipe', 'inherit', 'inherit'] });
const timer = setTimeout(() => child.kill(), 95000);
child.stdin.end(JSON.stringify(brief));
child.on('error', () => { clearTimeout(timer); process.exitCode = 1; });
child.on('close', code => { clearTimeout(timer); process.exitCode = code === 0 ? 0 : 1; });
