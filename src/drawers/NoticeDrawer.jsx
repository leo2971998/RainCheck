import { useMemo, useState } from 'react';
import { Icon, money, prettyIso } from '../components/ui.jsx';
import Drawer from '../components/Drawer.jsx';
import { reviewNotice } from '../engine/changes.js';
import { simulate, capacity, goalAt, hypothetical } from '../engine/forecast.js';
import { householdFor } from '../engine/plan.js';

/**
 * Bring in a notice the user has received.
 *
 * Nothing is accepted on RainCheck's say-so: the extracted amount and date are shown beside the
 * sentence they came from, the user picks which commitment it belongs to, and the consequence is
 * previewed before anything is added. A notice that cannot be read says so rather than guessing.
 */
export default function NoticeDrawer({ h, base, plan, cap, change, onClose }) {
  const [text, setText] = useState('');
  const [billId, setBillId] = useState(null);
  const [touched, setTouched] = useState(false);

  const year = Number(h.today.slice(0, 4));
  const review = useMemo(() => (text.trim() ? reviewNotice(text, h.recurring, year) : null), [text, h.recurring, year]);

  const chosenId = billId ?? review?.suggested?.id ?? null;
  const bill = h.recurring.find(r => r.id === chosenId) ?? null;
  const replacing = bill && plan.billChanges?.[bill.id];

  // What this change would do, run through the same forecast as everything else.
  const outcome = useMemo(() => {
    if (!review?.change || !bill) return null;
    const record = { ...review.change, increase: review.change.to - bill.amount, importedAt: h.today, noticeText: text };
    const after = householdFor(base, { ...plan, billChanges: { ...plan.billChanges, [bill.id]: record } });
    const scenario = hypothetical(plan, { contribution: plan.contribution ?? h.goal.planned });
    const capAfter = capacity(after, scenario);
    return { record, low: simulate(after, scenario).low, cap: capAfter, goal: goalAt(after, capAfter) };
  }, [review, bill, base, plan, h, text]);

  const add = () => {
    change({ billChanges: { [bill.id]: outcome.record } }, `${bill.label} change imported from a notice`);
    onClose();
  };

  return (
    <Drawer label="Import a notice" onClose={onClose}>
      <div className="row between">
        <h2>Import a notice</h2>
        <button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon n="x" s={16} /></button>
      </div>

      <p style={{ margin: 0, color: 'var(--ink-2)' }}>
        Paste an email or letter about a price change or renewal. RainCheck reads the amount and the date,
        shows you the sentence it took them from, and asks which commitment it belongs to.
      </p>

      <label className="grid" style={{ gap: 6 }}>
        <span className="label">The notice</span>
        <textarea value={text} onChange={e => { setText(e.target.value); setTouched(true); setBillId(null); }}
          rows={9} placeholder={'From: Northline Internet <billing@northline.example>\n\nYour Internet 300 plan will renew at $90.00 starting with your October 1 bill.'}
          aria-label="Paste the notice"
          style={{ font: '13px/1.55 ui-monospace, Consolas, monospace', padding: 12, borderRadius: 10, border: '1px solid var(--line)', resize: 'vertical', background: '#fff', color: 'var(--ink)' }} />
      </label>

      {touched && review?.problems.map(problem => (
        <div className="alert" key={problem}><b>Needs a look</b><p>{problem}</p></div>
      ))}

      {review?.change && (
        <>
          <h3>What RainCheck read</h3>
          <div className="kv">
            <span className="k">New amount</span><span className="v">{money(review.change.to)}/month</span>
            <span className="k">Takes effect</span><span className="v">{prettyIso(review.change.effective)}</span>
            <span className="k">Reason given</span><span className="v">{review.change.why}</span>
            {review.change.support && <><span className="k">Support address</span><span className="v">{review.change.support}</span></>}
          </div>

          <h3>Where it came from</h3>
          <div className="notice">{text.split('\n').map((line, i) => {
            const hit = review.change.evidence?.some(e => line.includes(e));
            return <div key={i}>{hit ? <mark>{line}</mark> : (line || ' ')}</div>;
          })}</div>
          <div className="fine">Only the highlighted sentences were used. Anything else in the notice was ignored.</div>

          <h3>Which commitment is this?</h3>
          <div className="row wrap" style={{ gap: 6 }}>
            {review.candidates.map(candidate => (
              <button key={candidate.id} className={'chip' + (chosenId === candidate.id ? ' on' : '')}
                aria-pressed={chosenId === candidate.id} onClick={() => setBillId(candidate.id)}>
                {candidate.label} · {money(candidate.amount)}
              </button>
            ))}
          </div>
          {review.suggested && !billId && <div className="fine">Suggested from the sender line. Choose another if that is wrong.</div>}

          {replacing && (
            <div className="alert">
              <b>{bill.label} already has an imported change.</b>
              <p>Adding this one replaces it at {money(replacing.to)}, so importing the same notice twice can never stack two increases on one bill.</p>
            </div>
          )}

          {outcome && (
            <div className="card" style={{ padding: 14, gap: 8 }}>
              <h3>What it would do</h3>
              <div className="ba">
                <div><span className="k">{bill.label}</span><b>{money(bill.amount)} → {money(outcome.record.to)}</b>
                  <span className="fine">{outcome.record.increase >= 0 ? '+' : ''}{money(outcome.record.increase)} a month</span></div>
                <div><span className="k">Lowest balance</span><b>{money(outcome.low.balance)}</b>
                  <span className="fine">{prettyIso(outcome.low.key)}</span></div>
                <div><span className="k">Contribution supported</span><b>{money(outcome.cap)}</b>
                  <span className="fine">now {money(cap)}</span></div>
                <div><span className="k">Goal reaches</span><b>{money(outcome.goal.projected)}</b>
                  <span className="fine">{outcome.goal.onTarget ? 'on target' : `${money(outcome.goal.gap)} short`}</span></div>
              </div>
            </div>
          )}

          <button className="btn" disabled={!bill || !outcome} onClick={add}>
            <Icon n="check" s={15} />Add this change to {bill ? bill.label.toLowerCase() : 'a bill'}
          </button>
          <div className="fine">
            This records what the provider says is coming. It does not pay anything, and you can undo it.
          </div>
        </>
      )}
    </Drawer>
  );
}
