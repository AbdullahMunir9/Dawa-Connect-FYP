import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { cn } from "../lib/format";

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
const TONES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-100",
  error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/60 dark:text-amber-100",
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/60 dark:text-sky-100",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback((type, title, description, duration = 4200) => {
    const id = ++counter.current;
    setToasts((list) => [...list.slice(-4), { id, type, title, description }]);
    if (duration) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toast = useMemo(() => ({
    success: (title, description) => push("success", title, description),
    error: (title, description) => push("error", title, description, 6500),
    warning: (title, description) => push("warning", title, description),
    info: (title, description) => push("info", title, description),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={cn("pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-float animate-pop", TONES[t.type])}>
              <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs leading-5 opacity-80">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="rounded-md p-1 opacity-60 hover:opacity-100" aria-label="Dismiss notification"><X className="h-3.5 w-3.5" /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
