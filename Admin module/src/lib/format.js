export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const pkr = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
export function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return pkr.format(number).replace("PKR", "Rs").replace(/\u00a0/g, " ");
}

export function formatCompact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

export function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-PK") : "—";
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && value.$date) return toDate(value.$date);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = {}) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric", ...options });
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatRelative(value) {
  const date = toDate(value);
  if (!date) return "—";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(-Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(-Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(-Math.round(seconds / 86400), "day");
  return formatDate(date);
}

export function percentChange(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (!p) return c ? 100 : 0;
  return ((c - p) / p) * 100;
}

export function initials(name = "") {
  return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

export function titleCase(value = "") {
  return String(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function truncate(value = "", length = 80) {
  const text = String(value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

/* ---------- status vocabulary ---------- */

// Fixed chart status palette (never reused as series colours).
export const STATUS_COLOR = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b", neutral: "#94a3b8" };

export const ORDER_STATUSES = ["Processing", "Confirmed", "Packed", "Dispatched", "Delivered", "Partially Delivered", "Cancelled"];

export function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (["active", "approved", "delivered", "resolved", "paid", "open now", "good"].includes(s)) return "success";
  if (["pending", "processing", "in_review", "in review", "confirmed", "packed", "partially delivered", "medium", "unapproved"].includes(s)) return "warning";
  if (["dispatched", "low", "info"].includes(s)) return "info";
  if (["suspended", "cancelled", "failed", "rejected", "dismissed", "high", "expired"].includes(s)) return "danger";
  if (s === "open") return "info";
  return "neutral";
}

export const PHARMACY_STATE_LABEL = { pending: "Pending review", approved: "Approved", suspended: "Suspended", rejected: "Rejected" };
export const COMPLAINT_STATUS_LABEL = { open: "Open", in_review: "In review", resolved: "Resolved", dismissed: "Dismissed" };
export const COMPLAINT_CATEGORY_LABEL = { order: "Order", delivery: "Delivery", product: "Product quality", payment: "Payment", service: "Service / behaviour", platform: "Platform / app", account: "Account", other: "Other" };

/* ---------- CSV export ---------- */

function escapeCsvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename, columns, rows) {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(typeof c.value === "function" ? c.value(row) : row[c.value])).join(","));
  const blob = new Blob(["﻿" + [header, ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
