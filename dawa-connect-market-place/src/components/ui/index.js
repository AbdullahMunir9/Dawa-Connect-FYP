"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/** Section title row with optional "View all" link. */
export function SectionHeader({ eyebrow, title, description, href, linkLabel = "View all", action, className }) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">{eyebrow}</p>}
        <h2 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {action || (href && (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900">
          {linkLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      ))}
    </div>
  );
}

export function Card({ children, className, as: Tag = "div", padded = true, ...props }) {
  return (
    <Tag className={cn("rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]", padded && "p-5 sm:p-6", className)} {...props}>
      {children}
    </Tag>
  );
}

const PILL_TONES = {
  gray: "bg-gray-100 text-gray-700 ring-gray-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function Pill({ children, tone = "gray", dot = false, className }) {
  const dotColor = { gray: "bg-gray-400", blue: "bg-blue-500", teal: "bg-teal-500", amber: "bg-amber-500", red: "bg-red-500", green: "bg-emerald-500" }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", PILL_TONES[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function orderTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "delivered") return "green";
  if (s === "cancelled") return "red";
  if (s === "partially delivered") return "amber";
  if (s === "dispatched") return "teal";
  return "blue";
}

export function StatusPill({ status, className }) {
  return <Pill tone={orderTone(status)} dot className={className}>{status}</Pill>;
}

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-lg bg-gray-200/80", className)} aria-hidden="true" />;
}

export function EmptyState({ icon: Icon, title, description, action, compact = false, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-12", className)}>
      {Icon && <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gray-100 text-gray-400"><Icon className="h-6 w-6" /></span>}
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function initials(name = "") {
  return String(name).trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "U";
}

export function formatDate(value, options = {}) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric", ...options });
}

export function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 60) return "just now";
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.round(seconds / 3600), "hour");
  if (seconds < 86400 * 30) return rtf.format(-Math.round(seconds / 86400), "day");
  return formatDate(date);
}
