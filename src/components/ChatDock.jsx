import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import './chat-dock.css';

function ChatIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a9 9 0 0 1 18 0Z" /><path d="M7 9h8M7 13h5" /></svg>;
}

export function ChatLauncher({ onOpen }) {
  return <button type="button" className="chat-launcher" onClick={onOpen} aria-label="Open RainCheck chat" aria-controls="raincheck-chat-dock" aria-expanded="false">
    <ChatIcon /><span>Ask RainCheck</span>
  </button>;
}

// Keep the content mounted: minimizing is not ending the ElevenLabs session.
export default function ChatDock({ open, onClose, children }) {
  const panel = useRef(null), [modal, setModal] = useState(false);
  useEffect(() => {
    const dialog = panel.current;
    if (!open) return;
    const opener = document.activeElement, small = window.matchMedia('(max-width: 900px)');
    const size = () => {
      dialog.style.setProperty('--chat-vh', `${window.visualViewport?.height || window.innerHeight}px`);
      dialog.style.setProperty('--chat-vtop', `${window.visualViewport?.offsetTop || 0}px`);
    };
    const show = () => {
      if (dialog.open) dialog.close();
      setModal(small.matches);
      size();
      if (small.matches) dialog.showModal(); else dialog.show();
      dialog.focus({ preventScroll: true });
    };
    show();
    small.addEventListener('change', show);
    window.visualViewport?.addEventListener('resize', size);
    window.visualViewport?.addEventListener('scroll', size);
    return () => {
      const restoreFocus = dialog.contains(document.activeElement);
      small.removeEventListener('change', show);
      window.visualViewport?.removeEventListener('resize', size);
      window.visualViewport?.removeEventListener('scroll', size);
      dialog.close();
      if (restoreFocus) {
        const target = opener?.isConnected && opener !== document.body ? opener : document.querySelector('.chat-launcher');
        target?.focus({ preventScroll: true });
      }
    };
  }, [open]);
  return <dialog id="raincheck-chat-dock" className="chat-dock" ref={panel} tabIndex={-1} aria-label="RainCheck chat" aria-modal={modal || undefined}
    onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}
    onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => {
      if (!modal || e.target !== e.currentTarget) return;
      const bounds = e.currentTarget.getBoundingClientRect();
      if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose();
    }}>
    <button type="button" className="chat-minimize" aria-label="Minimize chat" title="Minimize — keep this conversation" onClick={onClose}><Icon n="x" s={18} /></button>
    {children}
  </dialog>;
}
