import { useEffect, useRef } from 'react';
import { Icon } from './ui.jsx';

/**
 * A side panel that behaves like a dialog: Escape closes it, focus moves into it on open and
 * returns to whatever opened it on close, and Tab stays inside while it is open.
 *
 * Without this, a keyboard user opened the panel and was left on the button behind it, then had
 * to tab through the whole page to reach the content that had just appeared.
 */
export default function Drawer({ label, onClose, children }) {
  const panel = useRef(null);
  const opener = useRef(null);

  useEffect(() => {
    opener.current = document.activeElement;
    const behind = [...document.querySelectorAll('.app > main, .app > aside, .toasts')].map(el => [el, el.inert]);
    behind.forEach(([el]) => { el.inert = true; });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector('button, [href], input, select, textarea')?.focus();

    const onKey = e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = panel.current?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      behind.forEach(([el, inert]) => { el.inert = inert; });
      document.body.style.overflow = overflow;
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [onClose]);

  return (
    <div className="drawer-bg" onClick={onClose}>
      <div className="drawer" ref={panel} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function DrawerHeader({ title, icon = 'repeat', onClose }) {
  return (
    <div className="row between">
      <div className="cat"><i className="rec"><Icon n={icon} s={14} /></i><h2>{title}</h2></div>
      <button className="btn ghost sm" onClick={onClose} aria-label="Close">
        <Icon n="x" s={16} />
      </button>
    </div>
  );
}
