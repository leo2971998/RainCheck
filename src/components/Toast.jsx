import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';

/**
 * Toasts: a short, dismissable line about something that just happened.
 *
 * Used for two things only. A plan change reports its consequence in one sentence with an Undo
 * beside it, so cause and effect are read together instead of pieced together from four cards.
 * And a bill due soon is announced once per session, with the same Mark paid the reminder card
 * offers. Nothing here is a second source of truth: every figure in a toast is the figure the
 * screen already shows.
 */
let seq = 0;
let items = [];
const subs = new Set();
const emit = () => subs.forEach(fn => fn(items));

export const toast = {
  push(t) {
    const it = { id: ++seq, tone: 'neutral', ttl: 6500, actions: [], ...t };
    items = [...items, it].slice(-4);          // never a wall of them
    emit();
    if (it.ttl > 0) setTimeout(() => toast.dismiss(it.id), it.ttl);
    return it.id;
  },
  dismiss(id) { items = items.filter(i => i.id !== id); emit(); },
};

const ICON = { good: 'check', warn: 'warn', bad: 'warn', neutral: 'bell' };

export function Toasts() {
  const [list, setList] = useState(items);
  useEffect(() => { subs.add(setList); return () => subs.delete(setList); }, []);
  if (!list.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map(t => (
        <div key={t.id} className={'toast ' + t.tone}>
          <i className="toast-ic"><Icon n={ICON[t.tone] ?? 'bell'} s={14} /></i>
          <div className="toast-body">
            <b>{t.title}</b>
            {t.body && <span>{t.body}</span>}
          </div>
          {t.actions.map(a => (
            <button key={a.label} className="btn sm ghost" onClick={() => { a.run(); toast.dismiss(t.id); }}>{a.label}</button>
          ))}
          <button className="toast-x" aria-label="Dismiss" onClick={() => toast.dismiss(t.id)}><Icon n="x" s={13} /></button>
        </div>
      ))}
    </div>
  );
}
