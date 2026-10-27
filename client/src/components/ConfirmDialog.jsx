import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const dialog = useRef(null);
  const titleId = useId();
  const messageId = useId();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConfirm(); }
    finally { setBusy(false); }
  };

  return (
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={messageId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      onClick={(event) => { if (!busy && event.target === dialog.current) onCancel(); }}
      className="portal-confirm m-auto p-0 border-0 rounded-2xl bg-transparent w-[calc(100%-2rem)] max-w-sm overflow-visible text-slate-900">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 modal-enter">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle aria-hidden="true" className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id={titleId} className="text-base font-semibold">{title}</h3>
            <p id={messageId} className="text-sm text-slate-500 mt-1 break-words">{message}</p>
          </div>
          <button type="button" disabled={busy} onClick={onCancel} aria-label="Close confirmation"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg disabled:opacity-50">
            <X aria-hidden="true" className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" autoFocus disabled={busy} onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={confirm} aria-busy={busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-wait">
            {busy ? 'Deleting…' : confirmLabel || 'Delete'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
