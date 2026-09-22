import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "../../lib/format";
import { Button, Field, Textarea } from "./primitives";

function useLockScroll(active) {
  useEffect(() => {
    if (!active) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [active]);
}

function useEscape(active, onClose) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}

/* ------------------------------ Modal ------------------------------ */

export function Modal({ open, onClose, title, description, children, footer, size = "md", closeOnBackdrop = true }) {
  useLockScroll(open);
  useEscape(open, onClose);
  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-[2px] animate-fade sm:items-center" onMouseDown={closeOnBackdrop ? onClose : undefined}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}
        className={cn("w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-float animate-pop", width)} onMouseDown={(event) => event.stopPropagation()}>
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-muted hover:bg-surface-3 hover:text-ink" aria-label="Close dialog"><X className="h-4.5 w-4.5" /></button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------ Confirm dialog ------------------------------ */

/**
 * Replaces window.confirm. Pass `reason` to require/allow a free-text reason
 * ({ label, required, minLength, placeholder }).
 */
export function ConfirmDialog(props) {
  // The body is mounted only while open, so its local state resets automatically.
  return props.open ? <ConfirmDialogBody {...props} /> : null;
}

function ConfirmDialogBody({ onClose, onConfirm, title, description, confirmLabel = "Confirm", tone = "danger", reason = null, icon: Icon = AlertTriangle }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    const minLength = reason?.minLength ?? (reason?.required ? 5 : 0);
    if (reason?.required && text.trim().length < minLength) { setError(`Please provide at least ${minLength} characters.`); return; }
    setBusy(true); setError("");
    try {
      await onConfirm(text.trim());
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const toneClasses = { danger: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300", warning: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300", success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300", brand: "bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300" }[tone];
  const buttonVariant = { danger: "danger", warning: "primary", success: "success", brand: "primary" }[tone];

  return (
    <Modal open onClose={busy ? undefined : onClose} size="sm" closeOnBackdrop={!busy}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button variant={buttonVariant} onClick={confirm} loading={busy}>{confirmLabel}</Button></>}>
      <div className="flex gap-4">
        <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneClasses)}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
          {reason && (
            <Field label={reason.label || "Reason"} required={reason.required} error={error} className="mt-4" hint={reason.hint}>
              <Textarea autoFocus rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder={reason.placeholder || "Add a short note…"} maxLength={500} />
            </Field>
          )}
          {!reason && error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Drawer ------------------------------ */

export function Drawer({ open, onClose, title, subtitle, eyebrow, actions, children, footer, width = "max-w-2xl", loading = false }) {
  useLockScroll(open);
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/40 backdrop-blur-[1px] animate-fade" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" className={cn("flex h-full w-full flex-col border-l border-line bg-surface shadow-float animate-slide-right", width)} onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {eyebrow && <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-subtle">{eyebrow}</div>}
            <h2 className="truncate text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-3 hover:text-ink" aria-label="Close panel"><X className="h-5 w-5" /></button>
          </div>
        </header>
        <div className="relative flex-1 overflow-y-auto">
          {loading && <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-brand-100"><div className="h-full w-1/3 animate-[shimmer_1s_linear_infinite] bg-brand-500" /></div>}
          {children}
        </div>
        {footer && <footer className="border-t border-line bg-surface-2 px-5 py-3 sm:px-6">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}
