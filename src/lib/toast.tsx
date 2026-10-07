import React, { useEffect, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type Listener = (items: ToastItem[]) => void;

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  const snapshot = [...items];
  listeners.forEach((l) => l(snapshot));
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Show a toast. Default type is `info`. */
export function toast(message: string, type: ToastType = 'info') {
  const msg = String(message || '').trim() || '—';
  const id = nextId++;
  items = [...items.slice(-4), { id, message: msg, type }];
  emit();
  window.setTimeout(() => dismiss(id), type === 'error' ? 6000 : 4000);
}

/** Extract a user-facing message from an unknown error and show an error toast. */
export function toastError(e: unknown) {
  let msg = 'حدث خطأ';
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    msg = (e as { message: string }).message || msg;
  } else if (typeof e === 'string' && e.trim()) {
    msg = e;
  }
  toast(msg, 'error');
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-emerald-600 text-white border-emerald-700',
  error: 'bg-red-600 text-white border-red-700',
  info: 'bg-slate-800 text-white border-slate-900',
};

/** Mount once near the app root to render toasts. */
export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items);

  const onChange = useCallback((next: ToastItem[]) => setList(next), []);

  useEffect(() => {
    listeners.add(onChange);
    setList([...items]);
    return () => {
      listeners.delete(onChange);
    };
  }, [onChange]);

  if (list.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 inset-x-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none px-4"
      data-testid="toast-host"
      aria-live="polite"
    >
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          data-testid={`toast-${t.type}`}
          className={`pointer-events-auto max-w-md w-full sm:w-auto shadow-lg border rounded-xl px-4 py-3 text-sm font-medium text-center ${typeStyles[t.type]}`}
          onClick={() => dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
