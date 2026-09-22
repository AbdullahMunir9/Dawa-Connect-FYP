import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { cn, initials, statusTone } from "../../lib/format";

/* ------------------------------ Button ------------------------------ */

const BUTTON_VARIANTS = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20 disabled:hover:bg-brand-600",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong",
  ghost: "text-ink-2 hover:bg-surface-3",
  subtle: "bg-surface-3 text-ink hover:bg-line",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20",
  dangerOutline: "border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20",
  link: "text-brand-600 hover:text-brand-700 hover:underline px-0",
};
const BUTTON_SIZES = { xs: "h-7 px-2 text-xs gap-1 rounded-md", sm: "h-8 px-3 text-xs gap-1.5", md: "h-9.5 px-4 text-sm gap-2", lg: "h-11 px-5 text-sm gap-2", icon: "h-9 w-9 p-0", iconSm: "h-8 w-8 p-0" };

export const Button = forwardRef(function Button({ children, variant = "primary", size = "md", className, loading = false, disabled, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn("inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55", BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

/* ------------------------------ Badge ------------------------------ */

const BADGE_TONES = {
  neutral: "bg-surface-3 text-ink-2 ring-line",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900",
  warning: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900",
  danger: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900",
  info: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900",
  brand: "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:ring-brand-900",
  violet: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900",
};
const DOT = { neutral: "bg-slate-400", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-red-500", info: "bg-sky-500", brand: "bg-brand-500", violet: "bg-violet-500" };

export function Badge({ children, tone = "neutral", dot = false, className, size = "sm" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium ring-1 ring-inset", size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs", BADGE_TONES[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOT[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, label, ...props }) {
  return <Badge tone={statusTone(status)} dot {...props}>{label || String(status || "Unknown").replace(/_/g, " ")}</Badge>;
}

/* ------------------------------ Card ------------------------------ */

export function Card({ children, className, padded = true, as: Tag = "div", ...props }) {
  return <Tag className={cn("rounded-2xl border border-line bg-surface shadow-card", padded && "p-5", className)} {...props}>{children}</Tag>;
}

export function CardHeader({ title, description, actions, className }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------ Form fields ------------------------------ */

const fieldBase = "w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-subtle transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-2";

export function Field({ label, hint, error, required, children, className, htmlFor }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-2">{label}{required && <span className="text-red-500"> *</span>}</label>}
      {children}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, leading, trailing, ...props }, ref) {
  if (!leading && !trailing) return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />;
  return (
    <div className="relative">
      {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-subtle">{leading}</span>}
      <input ref={ref} className={cn(fieldBase, "h-10", leading && "pl-9", trailing && "pr-9", className)} {...props} />
      {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(fieldBase, "resize-y py-2 leading-6", className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(fieldBase, "h-10 appearance-none pr-9", className)} {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
    </div>
  );
});

export function SearchInput({ value, onChange, placeholder = "Search…", className, autoFocus }) {
  return (
    <Input
      type="search"
      value={value}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={cn("h-9.5", className)}
      leading={<Search className="h-4 w-4" />}
      trailing={value ? <button type="button" onClick={() => onChange("")} className="rounded-md p-1 text-subtle hover:bg-surface-3 hover:text-ink" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button> : null}
      aria-label={placeholder}
    />
  );
}

/* ------------------------------ Segmented / Tabs ------------------------------ */

export function Segmented({ options, value, onChange, className, size = "md" }) {
  return (
    <div role="tablist" className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto no-scrollbar rounded-lg bg-surface-3 p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition", size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]", active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
          >
            {option.icon && <option.icon className="h-3.5 w-3.5" />}
            {option.label}
            {option.count != null && <span className={cn("rounded-full px-1.5 text-[10px] tabular", active ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "bg-line text-muted")}>{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto no-scrollbar border-b border-line", className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button key={tab.value} role="tab" type="button" aria-selected={active} onClick={() => onChange(tab.value)}
            className={cn("-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition", active ? "border-brand-600 text-brand-700 dark:text-brand-300" : "border-transparent text-muted hover:text-ink")}>
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
            {tab.count != null && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] tabular", active ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "bg-surface-3 text-muted")}>{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Avatar ------------------------------ */

const AVATAR_COLORS = ["bg-brand-100 text-brand-800", "bg-sky-100 text-sky-800", "bg-violet-100 text-violet-800", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-800", "bg-emerald-100 text-emerald-800"];
export function Avatar({ name = "", size = "md", className, emoji, tone }) {
  const idx = [...String(name)].reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const dims = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" }[size];
  const color = tone === "brand" ? "bg-brand-600 text-white" : AVATAR_COLORS[idx];
  return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold dark:brightness-90", color, dims, className)} aria-hidden="true">{emoji || initials(name)}</span>;
}

/* ------------------------------ Skeleton / Empty ------------------------------ */

export function Skeleton({ className }) {
  return <div className={cn("shimmer rounded-md", className)} aria-hidden="true" />;
}

export function EmptyState({ icon: Icon, title, description, action, className, compact = false }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      {Icon && <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 text-muted"><Icon className="h-5 w-5" /></span>}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------ Key/Value ------------------------------ */

export function KeyValue({ items, columns = 2, className }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2", className)}>
      {items.filter(Boolean).map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-subtle">{item.label}</dt>
          <dd className={cn("mt-0.5 break-words text-sm text-ink", item.mono && "font-mono text-xs")}>{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------ Dropdown menu ------------------------------ */

export function Menu({ trigger, items, align = "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <span onClick={(event) => { event.stopPropagation(); setOpen((v) => !v); }} aria-haspopup="menu" aria-expanded={open} aria-controls={id}>{trigger}</span>
      {open && (
        <div id={id} role="menu" className={cn("absolute z-40 mt-1 min-w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-float animate-pop", align === "right" ? "right-0" : "left-0")} onClick={(event) => event.stopPropagation()}>
          {items.filter(Boolean).map((item, index) => item === "divider"
            ? <div key={`d-${index}`} className="my-1 h-px bg-line" />
            : (
              <button key={item.label} role="menuitem" type="button" disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick?.(); }}
                className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition disabled:opacity-50", item.danger ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40" : "text-ink hover:bg-surface-3")}>
                {item.icon && <item.icon className="h-4 w-4 opacity-70" />}
                {item.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Stat ------------------------------ */

export function Delta({ value, suffix = "%", invert = false, className }) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const number = Number(value);
  const positive = invert ? number < 0 : number > 0;
  const neutral = Math.abs(number) < 0.05;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular", neutral ? "bg-surface-3 text-muted" : positive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300", className)}>
      {neutral ? "±0" : `${number > 0 ? "▲" : "▼"} ${Math.abs(number).toFixed(Math.abs(number) >= 10 ? 0 : 1)}`}{neutral ? "" : suffix}
    </span>
  );
}
