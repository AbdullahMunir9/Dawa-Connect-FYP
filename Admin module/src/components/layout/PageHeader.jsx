import { RefreshCw } from "lucide-react";
import { cn, formatRelative } from "../../lib/format";
import { Button } from "../ui/primitives";

export function PageHeader({ title, description, actions, onRefresh, refreshing = false, updatedAt, className }) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {updatedAt && <span className="hidden text-xs text-subtle sm:inline">Updated {formatRelative(updatedAt)}</span>}
        {onRefresh && <Button variant="secondary" size="sm" onClick={() => onRefresh()} disabled={refreshing} aria-label="Refresh"><RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh</Button>}
        {actions}
      </div>
    </div>
  );
}

export function Toolbar({ children, className }) {
  return <div className={cn("flex flex-wrap items-center gap-2 border-b border-line px-4 py-3", className)}>{children}</div>;
}

export function Stat({ label, value, hint, icon: Icon, delta, tone = "brand", className, loading }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  };
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-4 shadow-card", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {Icon && <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tones[tone])}><Icon className="h-4 w-4" /></span>}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        {loading ? <span className="shimmer block h-8 w-24 rounded-md" /> : <span className="tabular text-2xl font-semibold tracking-tight text-ink">{value}</span>}
        {delta}
      </div>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}
