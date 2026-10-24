import { useState, useCallback, useMemo } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

import { ToastContext } from '../context/toast';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
};

const ICON_COLORS = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  warning: 'text-amber-500',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, exiting: false }]);

    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 200);
    }, duration);
    return id;
  }, []);

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((toast) => toast.id !== id)), []);

  const toast = useMemo(
    () => ({
      success: (msg) => addToast(msg, 'success'),
      error: (msg) => addToast(msg, 'error'),
      info: (msg) => addToast(msg, 'info'),
      warning: (msg, duration) => addToast(msg, 'warning', duration),
      dismiss,
    }),
    [addToast, dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div aria-live="polite" className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              className={`${COLORS[t.type]} ${t.exiting ? 'toast-exit' : 'toast-enter'} pointer-events-auto border rounded-lg px-4 py-3 shadow-lg flex items-start gap-3`}
            >
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${ICON_COLORS[t.type]}`} />
              <p className="text-sm font-medium leading-snug">{t.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
