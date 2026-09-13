// Explicit, paid live checks against the local app. Does not apply plans or change bank data.
import { TextConversation } from '../node_modules/@elevenlabs/client/dist/TextConversation.js';
import { writeFile } from 'node:fs/promises';
import { emptyPlan } from '../src/engine/plan.js';
import { chatBrief } from '../src/chat/brief.js';
import { savingsPreview } from '../src/engine/savings-plan.js';
import { CHAT_GROUNDING, compoundPreviewRequest, questionPreview, actionRequest, ACTION_REPLY, COMPOUND_REPLY } from '../src/chat/grounding.js';
if (!process.argv.includes('--live')) throw new Error('Pass --live to run cloud response checks.');
const origin = 'http://127.0.0.1:5176';
const report = { date: new Date().toISOString(), optimizer: [], conversations: [] };
const out = process.argv[process.argv.indexOf('--output') + 1];
if (!process.argv.includes('--output') || !out) throw new Error('Choose an output report path.');
async function api(path, body) {
  const res = await fetch(origin + path, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(115000) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Local API ${path} returned ${res.status}`);
  return data;
}
const household = await api('/api/household');
const plan = emptyPlan();
report.asOf = household.household.today;
const persist = () => writeFile(out, JSON.stringify(report, null, 2));

async function optimizer() {
  for (const protectedCategories of [['groceries'], []]) {
    console.log(`Testing optimization: groceries ${protectedCategories.length ? 'protected' : 'editable'}`);
    const result = await api('/api/review', { consent: true, baseVersion: household.baseVersion, plan, patch: {},
      kind: 'plan', focus: 'spending', optimize: true, protectedCategories, question: 'Optimize my budget.' });
    const draft = result.optimization?.draft;
    const preview = draft ? savingsPreview(household.household, plan, draft, Object.fromEntries(protectedCategories.map(k => [k, true]))) : null;
    report.optimizer.push({ protectedCategories, status: result.review?.status, response: result.review?.result,
      draft, calculated: preview ? { freed: preview.freed, extraSavings: preview.extraSavings, recovery: preview.guidance.recovery,
        goalNeeds: preview.guidance.additionalNeeded, fits: preview.impact.after.fits } : null });
    await persist(); console.log(`Optimization result: ${result.review?.status}`);
  }
}

async function conversation(questions, chatPlan = plan) {
  const transcript = { turns: [], greeting: '', tools: [] }; report.conversations.push(transcript);
  const { signedUrl } = await api('/api/chat-session', { consent: true });
  let pending, session, latest;
  const text = new Map();
  const received = (message, eventId) => {
    if (!message?.trim()) return;
    if (!transcript.greeting) { transcript.greeting = message; pending?.resolve(message); pending = null; return; }
    if (pending && !pending.ids.has(eventId)) {
      pending.ids.add(eventId); pending.resolve(message); pending = null;
    }
  };
  const waitReply = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending = null; reject(new Error('Chat reply timed out')); }, 70000);
    pending = { ids: new Set(), resolve: value => { clearTimeout(timer); resolve(value); } };
  });
  async function calculate(tool, args = {}) {
    const result = await api('/api/chat-context', { consent: true, baseVersion: household.baseVersion, plan: chatPlan, tool, args });
    latest = result;
    transcript.tools.push({ tool, args, preview: result.preview, low: result.impact.after.low,
      goalGap: result.impact.after.gap, fits: result.impact.after.fits, weekly: { spent: result.weekly?.spent, budget: result.weekly?.budget, overspent: result.weekly?.overspent } });
    return chatBrief(result);
  }
  try {
    const greeting = waitReply();
    session = await TextConversation.startSession({ signedUrl, connectionType: 'websocket', textOnly: true,
      clientTools: Object.fromEntries(['get_current_plan', 'preview_bill', 'preview_monthly_cost'].map(tool => [tool, args => calculate(tool, args)])),
      onMessage: ({ source, message, event_id }) => { if (source === 'ai') received(message, event_id); },
      onAgentChatResponsePart: part => {
        text.set(part.event_id, (text.get(part.event_id) || '') + part.text);
        // Use final agent_response only, avoiding the streamed-final duplicate racing the next question.
      },
      onError: () => console.log('Chat transport reported an error'),
    });
    await greeting;
    session.sendContextualUpdate(CHAT_GROUNDING);
    for (const question of questions) {
      if (compoundPreviewRequest(question) || actionRequest(question)) {
        transcript.turns.push({ question, answer: actionRequest(question) ? ACTION_REPLY : COMPOUND_REPLY, tools: [], handledBy: 'application capability guard' });
        await persist(); continue;
      }
      const start = transcript.tools.length;
      let context = await calculate('get_current_plan');
      const intent = questionPreview(question, latest.bills);
      if (intent) context = await calculate(intent.tool, intent.args);
      session.sendContextualUpdate('The application just calculated this question before sending it. Use these results, not mental arithmetic:\n' + context);
      const reply = waitReply();
      session.sendUserMessage(question);
      const answer = await reply;
      transcript.turns.push({ question, answer, tools: transcript.tools.slice(start).map(t => t.tool) });
      await persist(); console.log(`Chat answered: ${question}`);
    }
  } finally { await session?.endSession(); }
}
const jobs = await Promise.allSettled([
  optimizer(),
  (async () => {
    await conversation([
      'How is my plan doing? Please include any overspending, not just whether my savings goal fits.',
      'Household is $660 over budget. Can cutting $39.05 a month fix that by December? What should I do?',
      'What if my internet bill increases by $25?',
      'Add a $20 monthly subscription on top of that internet increase. Does the combined plan fit?',
      'Preview just a new $20 monthly subscription by itself.',
      'Change the internet bill to $25, not by $25. What changes?',
      'Please apply that change and transfer $100 to my savings.',
    ]);
    await conversation(['Does my current savings contribution fit? Please check before saying my goal is on track.'], { ...plan, contribution: 1000 });
  })(),
]);
report.errors = jobs.flatMap((r, i) => r.status === 'rejected' ? [{ area: i ? 'chat' : 'optimizer', message: r.reason.message }] : []);
await persist(); console.log(JSON.stringify({ optimizer: report.optimizer.map(o => o.status), conversations: report.conversations.map(c => c.turns.length), errors: report.errors }));
