import { useEffect, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { Streamdown } from 'streamdown';
import { Icon, money } from '../components/ui.jsx';
import { receiveMessage } from '../chat/messages.js';
import { chatBrief } from '../chat/brief.js';
import './chat.css';

const suggestions = ['How does my current plan look?', 'What if my internet bill increases by $25?', 'Could I add a $20 monthly subscription?'];
const markdown = {
  img: ({ alt }) => <span>{alt || 'Image omitted'}</span>,
  a: ({ children }) => <span>{children}</span>,
  code: ({ children }) => <span>{children}</span>,
  pre: ({ children }) => <p>{children}</p>,
};
async function post(path, body, signal) {
  let response, data;
  try {
    response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    data = await response.json();
  } catch { throw new Error('That request could not finish. Please check the connection and try again.'); }
  if (!response.ok) throw new Error(typeof data.message === 'string' && data.message.length < 240 && !/[<>]/.test(data.message) ? data.message : 'That request could not finish. Please try again.');
  return data;
}

export default function ChatPage(props) {
  return <ConversationProvider textOnly><Chat {...props} /></ConversationProvider>;
}

function Chat({ baseVersion, plan, visible }) {
  const [available, setAvailable] = useState(null);
  const [messages, setMessages] = useState([]), [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false), [starting, setStarting] = useState(false), [error, setError] = useState('');
  const [started, setStarted] = useState(false), [ready, setReady] = useState(false), [progress, setProgress] = useState('');
  const current = useRef({ baseVersion, plan }); current.current = { baseVersion, plan };
  const list = useRef(null), input = useRef(null), stick = useRef(true), lock = useRef(false);
  const allowed = useRef(false), requests = useRef(new Set()), generation = useRef(0);
  const responseText = useRef(new Map());
  const finish = () => { lock.current = false; setBusy(false); setProgress(''); };
  async function calculate(tool, args) {
    if (!allowed.current) return JSON.stringify({ error: 'This chat has ended. No calculation was made.' });
    const session = generation.current, controller = new AbortController(); requests.current.add(controller);
    setProgress('Checking your forecast…');
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const result = await post('/api/chat-context', { consent: true, ...current.current, tool, args: args || {} }, controller.signal);
      if (!allowed.current || session !== generation.current) return JSON.stringify({ error: 'Chat ended. Discard this result.' });
      setMessages(ms => [...ms, { id: crypto.randomUUID(), role: 'calculation', result }]);
      setProgress('Putting the answer together…');
      return chatBrief(result);
    } catch (e) {
      const message = controller.signal.aborted ? 'The calculation timed out. No result is available.' : e.message;
      if (allowed.current && session === generation.current) setError(`${message} Current numbers were not verified; chat has not changed your plan.`);
      return `Calculation unavailable: ${message} No current numbers were verified. Earlier results may be out of date. Do not describe an earlier balance or unchanged plan as freshly checked. Ask the user to retry; do not invent a scenario result.`;
    } finally { clearTimeout(timeout); requests.current.delete(controller); }
  }
  const chat = useConversation({
    textOnly: true,
    clientTools: {
      get_current_plan: args => calculate('get_current_plan', args),
      preview_bill: args => calculate('preview_bill', args),
      preview_monthly_cost: args => calculate('preview_monthly_cost', args),
    },
    onConnect: () => { setStarting(false); setStarted(true); },
    onMessage: ({ source, message, event_id }) => {
      if (source !== 'ai' || !message.trim()) return;
      setReady(true);
      setMessages(ms => receiveMessage(ms, { event_id, text: message })); finish();
    },
    onAgentChatResponsePart: part => {
      responseText.current.set(part.event_id, (responseText.current.get(part.event_id) || '') + part.text);
      setMessages(ms => receiveMessage(ms, part));
      if (part.type === 'stop' && responseText.current.get(part.event_id)?.trim()) finish();
    },
    onDisconnect: () => { allowed.current = false; generation.current++; requests.current.forEach(c => c.abort()); setStarting(false); setReady(false); finish(); },
    onError: () => { setError('The chat connection had a problem. End this chat and start a new one to try again. Your plan is unchanged.'); setStarting(false); finish(); },
  });
  const connected = chat.status === 'connected';
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); setAvailable(false); }, 10000);
    fetch('/api/chat-session', { signal: controller.signal }).then(r => r.json()).then(d => setAvailable(d.available === true)).catch(() => { if (!controller.signal.aborted) setAvailable(false); }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);
  useEffect(() => () => { allowed.current = false; generation.current++; requests.current.forEach(c => c.abort()); chat.endSession(); }, [chat.endSession]);
  useEffect(() => {
    if (connected) chat.sendContextualUpdate('The saved plan or bank data may have changed. Retrieve the latest current plan before using any budget numbers. Previous previews are not saved.');
  }, [baseVersion, plan, connected, chat.sendContextualUpdate]);
  useEffect(() => {
    if (visible && stick.current && list.current) list.current.scrollTop = messages.length ? list.current.scrollHeight : 0;
  }, [messages, progress, visible]);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => { setError('The reply timed out. Please start a new chat to reconnect. Your plan is unchanged.'); stop(); }, 60000);
    return () => clearTimeout(timer);
  }, [busy]);

  async function start() {
    if (starting || connected || !available || !baseVersion) return;
    const session = ++generation.current, controller = new AbortController(); requests.current.add(controller);
    const timeout = setTimeout(() => controller.abort(), 15000);
    setStarting(true); setReady(false); setError('');
    try {
      const { signedUrl } = await post('/api/chat-session', { consent: true }, controller.signal);
      if (session !== generation.current || controller.signal.aborted) return;
      setMessages([]); responseText.current.clear(); allowed.current = true; stick.current = true;
      chat.startSession({ signedUrl, connectionType: 'websocket', textOnly: true });
    } catch (e) { if (session === generation.current) { allowed.current = false; setError(e.message); setStarting(false); } }
    finally { clearTimeout(timeout); requests.current.delete(controller); }
  }
  function stop() {
    allowed.current = false; generation.current++; requests.current.forEach(c => c.abort());
    chat.endSession(); finish(); setStarting(false);
  }
  function send(text = draft) {
    text = text.trim();
    if (!text || text.length > 2000 || !connected || !ready || lock.current) return;
    lock.current = true; setBusy(true); setError(''); stick.current = true;
    setMessages(ms => [...ms, { id: crypto.randomUUID(), role: 'user', text }]);
    setDraft(''); setProgress('Thinking through your question…');
    try { chat.sendUserMessage(text); input.current?.focus(); }
    catch { setDraft(text); setError('Your message was not sent. End this chat and reconnect to try again.'); finish(); }
  }
  return <section className="chat-page" aria-labelledby="chat-title">
    <header className="chat-header">
      <div className="chat-heading"><span className="chat-emblem"><Icon n="spark" s={22} /></span><div><h1 id="chat-title">Ask RainCheck</h1><p>Your plan. A little clearer.</p></div></div>
      <div className="chat-connection"><span className={`chat-dot${connected ? ' connected' : ''}`} />{connected ? 'Connected' : starting ? 'Connecting…' : 'Text chat'}{(connected || starting) && <button className="btn ghost sm" onClick={stop}>End chat</button>}</div>
    </header>
    <div className="chat-shell">
      <div className="chat-thread" ref={list} role="log" aria-label="Conversation" aria-live="polite" onScroll={e => { const el=e.currentTarget; stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<80; }}>
        {!started && !messages.length && <div className="chat-welcome"><span className="chat-welcome-icon"><Icon n="spark" s={32} /></span><h2>Let’s make sense of your money.</h2><p>Ask about your forecast, then try a change.<br />We’ll show the numbers and talk through what they mean.</p><div className="chat-examples">{suggestions.map((q,i) => <button key={q} onClick={() => { if (connected) send(q); else { setDraft(q); input.current?.focus(); } }}><span>0{i+1}</span>{q}<Icon n="arrow" s={15} /></button>)}</div></div>}
        {messages.map(m => m.role === 'calculation' ? <Calculation key={m.id} result={m.result} /> : <article key={m.id} className={`chat-message ${m.role}`} aria-label={m.role === 'user' ? 'You' : 'RainCheck'}><span className="chat-speaker">{m.role === 'user' ? 'You' : 'RainCheck'}</span><div className="chat-bubble">{m.role === 'user' ? m.text : <Streamdown skipHtml controls={false} components={markdown} isAnimating={m.streaming}>{m.text}</Streamdown>}</div></article>)}
        {busy && <p className="chat-progress" role="status"><span className="chat-dot connected" />{progress || 'Thinking…'}</p>}
        {connected && !ready && <p className="chat-progress" role="status">Getting ready for your question…</p>}
      </div>
      <div className="chat-bottom">
        {error && <p className="chat-error" role="alert">{error}</p>}
        {!connected && <div className="chat-start">
          {started && <p>This conversation has ended. Starting again opens a new conversation; earlier messages are not carried over.</p>}
          <button className="btn" onClick={start} disabled={starting || !available || !baseVersion}>{starting ? 'Connecting…' : started ? 'Start a new chat' : 'Start chatting'}</button>
          {available === null ? <p role="status">Checking chat availability…</p> : (!available || !baseVersion) && <p>Chat is available in the connected local test workspace. Refresh after starting the server and loading bank data.</p>}
        </div>}
        <form className="chat-compose" onSubmit={e => { e.preventDefault(); send(); }}>
          <label className="sr-only" htmlFor="chat-message">Your message</label>
          <textarea id="chat-message" ref={input} value={draft} onChange={e => setDraft(e.target.value)} placeholder={connected ? 'Ask a question or try a what-if…' : 'Your question…'} maxLength={2000} rows={2} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
          <button type="submit" className="btn" aria-label="Send message" disabled={!connected || !ready || busy || !draft.trim()}><Icon n="arrow" s={18} /><span>Send</span></button>
        </form>
        <div className="chat-attribution"><span>Powered by ElevenLabs Agents</span><details><summary>What is shared?</summary><p>Starting a chat shares your messages, selected sandbox forecast results and matching bank-record excerpts with ElevenLabs. Its current settings retain conversation transcripts. Bill review notes are not shared. This chat never uses your microphone.</p></details></div>
        <p className="chat-footnote">Estimates, not guarantees. Chat previews never change your saved plan.</p>
      </div>
    </div>
  </section>;
}

function Calculation({ result: { impact, preview, retrieval } }) {
  const after = impact.after;
  return <details className="chat-calculation" open={!!preview}>
    <summary><Icon n="trend" s={16} />{preview ? `${preview.label}: ${money(preview.amount)} · Preview only` : 'Current forecast checked'}<span>View numbers</span></summary>
    <div className="chat-calculation-body"><dl><div><dt>Lowest checking balance</dt><dd>{preview && <del>{money(impact.before.low)}</del>}{money(after.low)}</dd></div><div><dt>Projected goal savings</dt><dd>{preview && <del>{money(impact.before.projected)}</del>}{money(after.projected)}</dd></div></dl>
      <p>{!after.feasible || !after.fits ? 'Planned saving rate is not fully supported by this cash flow. The goal projection assumes those contributions still happen.' : 'Uses your planned savings contributions.'}</p>
      <p>Forecast from {impact.asOf} · {impact.windowDays} days · Cushion {money(impact.cushion)}{preview ? ` · Change starts ${preview.startsOn}` : ''}</p>
      {retrieval?.evidence.length > 0 && <details><summary>Records used ({retrieval.evidence.length})</summary><ul>{retrieval.evidence.map((r,i) => <li key={i}>{r.title} <small>· as of {r.asOf}</small></li>)}</ul></details>}
      {retrieval?.status !== 'matched' && <p>Supporting bank-record search was unavailable or found no matching records. These numbers come from the calculator.</p>}
    </div>
  </details>;
}
