import { useState } from 'react';
import { Icon, money, prettyIso } from '../components/ui.jsx';
import { goalAt } from '../engine/forecast.js';
import { questionFor } from '../engine/changes.js';
import Drawer from '../components/Drawer.jsx';

export default function BillDrawer({ h, notice, plan, change, cap, onCompare, onClose }) {
  const [drafting, setDrafting] = useState(false);
  const [copied, setCopied] = useState(false);

  const bill = h.recurring.find(x => x.change);
  if (!bill) return null;
  const billChange = bill.change;
  const increase = plan.increase;
  const goal = goalAt(h, cap);
  // An amount the user typed is an assumption. The notice establishes its own figure, and the
  // app must not keep claiming the provider confirmed a number they never wrote.
  const isWhatIf = increase !== billChange.increase;
  const question = questionFor(bill, billChange);

  const copy = async () => {
    try { await navigator.clipboard.writeText(question); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the textarea is selectable either way */ }
  };

  return (
    <Drawer label="Bill change details" onClose={onClose}>
        <div className="row between">
          <div className="cat"><i className="rec"><Icon n="repeat" s={14} /></i><h2>{bill.label}</h2></div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon n="x" s={16} /></button>
        </div>

        <div className="row wrap" style={{ gap: 6 }}>
          <span className="pill warn"><Icon n="up" s={11} />Upcoming increase</span>
          {isWhatIf
            ? <span className="pill accent">What-if scenario · not what the notice says</span>
            : <span className="pill good"><Icon n="check" s={11} />Confirmed from a notice</span>}
        </div>

        {isWhatIf && (
          <div className="alert">
            <b>You are exploring {money(increase)} a month.</b>
            <p>The notice itself says {money(billChange.increase)}, taking the bill to {money(bill.amount + billChange.increase)}.
               The evidence below still shows what the provider actually wrote.
               <button className="link" style={{ fontSize: 13, marginLeft: 6 }}
                 onClick={() => change({ increase: billChange.increase }, 'Back to the notice amount')}>Use the notice amount</button></p>
          </div>
        )}

        <div className="kv">
          <span className="k">Previous recurring amount</span><span className="v">{money(bill.amount)}/month</span>
          <span className="k">New recurring amount</span><span className="v">{money(bill.amount + increase)}/month</span>
          <span className="k">Increase</span><span className="v" style={{ fontWeight: 700 }}>{money(increase)}/month{isWhatIf && <div className="fine">notice says {money(billChange.increase)}</div>}</span>
          <span className="k">Explanation</span><span className="v">{billChange.why}</span>
          <span className="k">Next affected payment</span><span className="v">{prettyIso(billChange.effective)}</span>
        </div>

        <h3>Evidence</h3>
        <div className="notice">{notice.split('\n').map((line, i) => {
          const hit = billChange.evidence?.some(e => line.includes(e));
          return <div key={i}>{hit ? <mark>{line}</mark> : (line || ' ')}</div>;
        })}</div>
        <div className="fine">A price change, not higher usage, a longer billing period, or a one-time fee. The next posted charge will confirm it.</div>

        <h3>What it changes in your plan</h3>
        <div className="ba">
          <div><span className="k">Supported contribution</span><b>{money(cap)}</b><span className="fine">was {money(h.goal.planned)}</span></div>
          <div><span className="k">Goal at target date</span><b>{money(goal.projected)}</b>
            <span className="fine">{goal.gap ? `${money(goal.gap)} short of ${money(h.goal.target)}` : 'on target'}</span></div>
        </div>

        <h3>Try a different amount</h3>
        <div className="row">
          <span className="muted">Increase of</span>
          <input type="number" min="0" step="5" value={increase} aria-label="Increase amount"
            onChange={e => change({ increase: Math.max(0, Number(e.target.value) || 0) }, 'Increase amount changed')} />
          <span className="muted">per month. Everything recomputes.</span>
        </div>

        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn" onClick={onCompare}>Compare options <Icon n="arrow" s={15} /></button>
          {billChange.support
            ? <a className="btn ghost sm" href={`https://${billChange.support}`} target="_blank" rel="noopener noreferrer"><Icon n="ext" s={14} />{billChange.support}</a>
            : <span className="fine">The notice does not name a support address.</span>}
          <button className="btn ghost sm" aria-expanded={drafting} onClick={() => setDrafting(v => !v)}>
            <Icon n="mail" s={14} />{drafting ? 'Hide question' : 'Prepare a question'}
          </button>
        </div>

        {drafting && (
          <div className="grid" style={{ gap: 8 }}>
            <textarea readOnly value={question} rows={12} aria-label="Draft question for the provider"
              style={{ font: '13px/1.5 ui-monospace, Consolas, monospace', padding: 12, borderRadius: 10, border: '1px solid var(--line)', resize: 'vertical', background: 'var(--bg)', color: 'var(--ink)' }} />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sm" onClick={copy}><Icon n={copied ? 'check' : 'mail'} s={14} />{copied ? 'Copied' : 'Copy question'}</button>
              <span className="fine">Every figure here comes from your records or the notice. Nothing is invented.</span>
            </div>
          </div>
        )}

        <div className="fine">RainCheck does not promise to negotiate this, and does not call every increase an error.</div>
    </Drawer>
  );
}
