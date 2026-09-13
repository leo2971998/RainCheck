import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';

const CloseContext = createContext(null);

/**
 * A side panel that behaves like a dialog: Escape closes it, focus moves into it on open and
 * returns to whatever opened it on close, and Tab stays inside while it is open.
 *
 * Without this, a keyboard user opened the panel and was left on the button behind it, then had
 * to tab through the whole page to reach the content that had just appeared.
 */
export default function Drawer({ label, onClose, children, className = '', protectChanges = false, dirty = false, busy = false, variant = 'drawer' }) {
  const panel = useRef(null);
  const opener = useRef(null);
  const lastFocus = useRef(null);
  const edited = useRef(false);
  const [discard, setDiscard] = useState(false);
  const close = useRef(onClose);
  const requestClose = () => {
    if (busy) return;
    if (dirty || (protectChanges && edited.current)) {
      lastFocus.current = document.activeElement;
      setDiscard(true);
    } else onClose();
  };
  close.current = () => discard ? setDiscard(false) : requestClose();

  useEffect(() => {
    if (discard) panel.current?.querySelector('[data-keep-editing]')?.focus();
    else if (lastFocus.current?.isConnected) lastFocus.current.focus();
  }, [discard]);

  useEffect(() => {
    opener.current = document.activeElement;
    const behind = [...document.querySelectorAll('.app > main, .app > aside, .toasts')].map(el => [el, el.inert]);
    behind.forEach(([el]) => { el.inert = true; });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (panel.current?.querySelector('[data-initial-focus]') || panel.current?.querySelector('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || panel.current)?.focus();

    const onKey = e => {
      // A confirmation layered over this drawer owns keyboard actions until it closes.
      const above = document.querySelector('.modal-bg');
      if (above && !above.contains(panel.current)) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const focusable = [...(panel.current?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])') || [])]
        .filter(el => !el.closest('[hidden]') && (!el.closest('details:not([open])') || el.closest('details:not([open])').querySelector('summary') === el));
      if (!focusable.length) { e.preventDefault(); panel.current?.focus(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!focusable.includes(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      behind.forEach(([el, inert]) => { el.inert = inert; });
      document.body.style.overflow = overflow;
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, []); // Opening/closing manages focus; changing a form field must never steal it.

  return (
    <div className={`${variant}-bg`}>
      <div className={`${variant} ${className}`} ref={panel} tabIndex={-1} role={discard ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={discard ? 'Discard unsaved changes?' : label}>
        {discard && <section className="drawer-discard">
          <h2>Discard unsaved changes?</h2><p>Your saved plan will stay as it is.</p>
          <div className="row wrap budget-actions">
            <button type="button" className="btn" data-keep-editing onClick={() => setDiscard(false)}>Keep editing</button>
            <button type="button" className="btn ghost" onClick={onClose}>Discard changes</button>
          </div>
        </section>}
        <CloseContext.Provider value={{ close: requestClose, busy }}>
          <div className="drawer-content" hidden={discard} onChangeCapture={e => { if (e.target.closest('form')) edited.current = true; }}>
            {children}
          </div>
        </CloseContext.Provider>
      </div>
    </div>
  );
}

export function DrawerHeader({ title, icon = 'repeat', onClose }) {
  return (
    <div className="row between">
      <div className="cat"><i className="rec"><Icon n={icon} s={14} /></i><h2>{title}</h2></div>
      <DrawerCloseButton className="btn ghost sm" onClose={onClose} aria-label="Close">
        <Icon n="x" s={16} />
      </DrawerCloseButton>
    </div>
  );
}

export function DrawerCloseButton({ onClose, children, ...props }) {
  const context = useContext(CloseContext);
  return <button {...props} type="button" disabled={context?.busy || props.disabled} onClick={context?.close || onClose}>{children}</button>;
}
