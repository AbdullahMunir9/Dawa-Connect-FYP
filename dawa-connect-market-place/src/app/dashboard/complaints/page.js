"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { MessageSquareWarning, Building2, ShieldCheck, Send, ChevronLeft, Plus, Loader2, CheckCircle2, Clock3, XCircle, RotateCcw, Info } from "lucide-react";

const CATEGORIES = [
  { value: "order", label: "Order problem" }, { value: "delivery", label: "Delivery" }, { value: "product", label: "Product quality / expiry" },
  { value: "payment", label: "Payment / refund" }, { value: "service", label: "Service or behaviour" }, { value: "platform", label: "App or website issue" },
  { value: "account", label: "My account" }, { value: "other", label: "Something else" },
];
const STATUS_META = {
  open: { label: "Open", className: "bg-amber-50 text-amber-800 border-amber-200", Icon: Clock3 },
  in_review: { label: "In review", className: "bg-blue-50 text-blue-800 border-blue-200", Icon: RotateCcw },
  resolved: { label: "Resolved", className: "bg-teal-50 text-teal-800 border-teal-200", Icon: CheckCircle2 },
  dismissed: { label: "Closed", className: "bg-gray-100 text-gray-700 border-gray-200", Icon: XCircle },
};
const ROLE_LABEL = { customer: "You", pharmacy: "Pharmacy", admin: "DawaConnect support" };

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.open;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}><meta.Icon className="h-3 w-3" />{meta.label}</span>;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

function NewComplaintForm({ pharmacies, orders, initial, onCancel, onCreated }) {
  const [form, setForm] = useState({ target: initial.pharmacyId ? "pharmacy" : "admin", pharmacyId: initial.pharmacyId || "", orderId: initial.orderId || "", category: initial.orderId ? "order" : "other", subject: "", description: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));
  const relevantOrders = form.target === "pharmacy" && form.pharmacyId ? orders.filter((o) => o.pharmacies.some((p) => p.id === form.pharmacyId)) : orders;

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.target === "pharmacy" && !form.pharmacyId) { setError("Select the pharmacy this complaint is about."); return; }
    if (form.subject.trim().length < 5) { setError("Give your complaint a short subject (at least 5 characters)."); return; }
    if (form.description.trim().length < 20) { setError("Please describe the problem in at least 20 characters."); return; }
    setSaving(true);
    try {
      const data = await readJson(await fetch("/api/complaints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }));
      onCreated(data.complaint);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">New complaint</h2>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"><ChevronLeft className="h-4 w-4" /> Back</button>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-gray-800 mb-2">Who should handle this?</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          {[{ value: "pharmacy", Icon: Building2, title: "A pharmacy", text: "Issues with a specific order, delivery, medicine or the pharmacy’s service. The pharmacy replies directly." },
            { value: "admin", Icon: ShieldCheck, title: "DawaConnect support", text: "Problems with the app, your account, payments, or a pharmacy that isn’t responding." }].map((option) => (
            <label key={option.value} className={`cursor-pointer rounded-xl border p-4 transition ${form.target === option.value ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-600" : "border-gray-200 hover:border-gray-300"}`}>
              <input type="radio" name="target" value={option.value} checked={form.target === option.value} onChange={set("target")} className="sr-only" />
              <div className="flex items-center gap-2 font-semibold text-gray-900"><option.Icon className="h-4 w-4 text-blue-700" />{option.title}</div>
              <p className="mt-1 text-xs text-gray-600 leading-5">{option.text}</p>
            </label>
          ))}
        </div>
      </fieldset>

      {form.target === "pharmacy" && (
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5" htmlFor="complaint-pharmacy">Pharmacy</label>
          <select id="complaint-pharmacy" value={form.pharmacyId} onChange={(e) => setForm((f) => ({ ...f, pharmacyId: e.target.value, orderId: "" }))} className={inputClass} required>
            <option value="">Select a pharmacy you have ordered from…</option>
            {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {pharmacies.length === 0 && <p className="mt-1.5 text-xs text-amber-700 inline-flex items-center gap-1"><Info className="h-3.5 w-3.5" /> You can complain about a pharmacy once you have placed an order with it. For anything else, contact DawaConnect support.</p>}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5" htmlFor="complaint-order">Related order <span className="font-normal text-gray-500">(optional)</span></label>
          <select id="complaint-order" value={form.orderId} onChange={set("orderId")} className={inputClass}>
            <option value="">No specific order</option>
            {relevantOrders.map((o) => <option key={o.orderId} value={o.orderId}>{o.orderId} · {o.status} · {new Date(o.createdAt).toLocaleDateString("en-PK")}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5" htmlFor="complaint-category">Category</label>
          <select id="complaint-category" value={form.category} onChange={set("category")} className={inputClass}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1.5" htmlFor="complaint-subject">Subject</label>
        <input id="complaint-subject" value={form.subject} onChange={set("subject")} maxLength={120} placeholder="e.g. Received expired medicine" className={inputClass} required />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1.5" htmlFor="complaint-description">What happened?</label>
        <textarea id="complaint-description" value={form.description} onChange={set("description")} rows={5} maxLength={2000} placeholder="Describe the problem, what you expected, and what outcome you are looking for (refund, replacement, information…)." className={inputClass} required />
        <p className="mt-1 text-xs text-gray-500 text-right">{form.description.length}/2000</p>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-800 hover:bg-blue-900 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit complaint</button>
      </div>
    </form>
  );
}

function ComplaintThread({ complaint, onBack, onUpdated }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const closed = ["resolved", "dismissed"].includes(complaint.status);
  const handledBy = complaint.target === "pharmacy" ? complaint.pharmacyName || "the pharmacy" : "DawaConnect support";

  async function send(event) {
    event.preventDefault();
    if (!reply.trim()) return;
    setSending(true); setError("");
    try {
      const data = await readJson(await fetch(`/api/complaints/${complaint._id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: reply.trim() }) }));
      onUpdated(data.complaint);
      setReply("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="p-6 border-b border-gray-100">
        <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-3"><ChevronLeft className="h-4 w-4" /> All complaints</button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-mono text-gray-500">{complaint.complaintId}</p>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">{complaint.subject}</h2>
            <p className="text-sm text-gray-600 mt-1">Handled by <span className="font-semibold text-gray-800">{handledBy}</span> · Filed {formatDate(complaint.createdAt)}{complaint.orderId ? <> · Order <span className="font-mono">{complaint.orderId}</span></> : null}</p>
          </div>
          <StatusPill status={complaint.status} />
        </div>
        <div className="mt-4 rounded-lg bg-gray-50 border border-gray-100 p-4 text-sm text-gray-800 whitespace-pre-wrap leading-6">{complaint.description}</div>
        {complaint.resolution?.note && <div className="mt-3 rounded-lg bg-teal-50 border border-teal-200 p-3 text-sm text-teal-900"><span className="font-semibold">Outcome:</span> {complaint.resolution.note}</div>}
      </div>

      <div className="p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Conversation</h3>
        {complaint.messages?.length ? (
          <ul className="flex flex-col gap-3">
            {complaint.messages.map((m, i) => {
              const mine = m.by?.role === "customer";
              return (
                <li key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mine ? "bg-blue-800 text-white rounded-tr-sm" : "bg-gray-100 text-gray-900 rounded-tl-sm"}`}>
                    <p className={`text-[11px] font-semibold mb-1 ${mine ? "text-blue-100" : "text-gray-500"}`}>{mine ? "You" : `${m.by?.name || ROLE_LABEL[m.by?.role]} · ${ROLE_LABEL[m.by?.role]}`}</p>
                    <p className="whitespace-pre-wrap leading-6">{m.text}</p>
                    <p className={`text-[10px] mt-1 ${mine ? "text-blue-200" : "text-gray-400"}`}>{formatDate(m.at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-gray-500 rounded-lg bg-gray-50 p-4">No replies yet. {handledBy} will respond here; you will also see updates on this page.</p>}

        <form onSubmit={send} className="mt-5 flex flex-col gap-2">
          {closed && <p className="text-xs text-gray-500 inline-flex items-center gap-1"><Info className="h-3.5 w-3.5" /> This complaint is closed. Sending a new message will reopen it.</p>}
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={2000} placeholder="Add more details or reply…" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end"><button type="submit" disabled={sending || !reply.trim()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-800 hover:bg-blue-900 disabled:opacity-60">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {closed ? "Reopen & send" : "Send"}</button></div>
        </form>
      </div>
    </div>
  );
}

function ComplaintsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [data, setData] = useState({ complaints: [], pharmacies: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState(() => (searchParams.get("new") ? "new" : "list"));
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      setLoadError("");
      setData(await readJson(await fetch("/api/complaints")));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const selected = data.complaints.find((c) => c._id === selectedId) || null;
  const visible = useMemo(() => data.complaints.filter((c) => filter === "all" || (filter === "open" ? ["open", "in_review"].includes(c.status) : ["resolved", "dismissed"].includes(c.status))), [data, filter]);
  const openCount = data.complaints.filter((c) => ["open", "in_review"].includes(c.status)).length;

  function upsert(complaint) {
    setData((d) => ({ ...d, complaints: d.complaints.some((c) => c._id === complaint._id) ? d.complaints.map((c) => (c._id === complaint._id ? complaint : c)) : [complaint, ...d.complaints] }));
  }

  if (!user) return <div className="py-8 text-center text-red-500">Please log in.</div>;

  if (view === "new") {
    return <NewComplaintForm pharmacies={data.pharmacies} orders={data.orders} initial={{ pharmacyId: searchParams.get("pharmacyId") || "", orderId: searchParams.get("orderId") || "" }}
      onCancel={() => setView("list")} onCreated={(complaint) => { upsert(complaint); setSelectedId(complaint._id); setView("list"); }} />;
  }
  if (selected) return <ComplaintThread complaint={selected} onBack={() => setSelectedId(null)} onUpdated={upsert} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Support &amp; Complaints</h1>
          <p className="text-sm text-gray-600">Raise a problem with a pharmacy you ordered from, or contact DawaConnect support directly.</p>
        </div>
        <button type="button" onClick={() => setView("new")} className="inline-flex items-center gap-2 bg-blue-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-900"><Plus className="h-4 w-4" /> New complaint</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[["Total", data.complaints.length, MessageSquareWarning, "bg-blue-100 text-blue-700"], ["Open", openCount, Clock3, "bg-amber-100 text-amber-700"], ["Resolved", data.complaints.filter((c) => c.status === "resolved").length, CheckCircle2, "bg-teal-100 text-teal-700"]].map(([label, value, Icon, tone]) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${tone}`}><Icon className="w-5 h-5" /></div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 p-3 border-b border-gray-100">
          {[["all", "All"], ["open", "Open"], ["closed", "Closed"]].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === value ? "bg-blue-50 text-blue-800" : "text-gray-600 hover:bg-gray-50"}`}>{label}</button>
          ))}
        </div>
        {loading ? <div className="py-12 text-center text-gray-500 inline-flex w-full justify-center items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading complaints…</div>
          : loadError ? <div className="py-12 text-center text-red-600">{loadError}</div>
          : visible.length === 0 ? (
            <div className="py-14 text-center px-6">
              <MessageSquareWarning className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 font-semibold text-gray-900">{data.complaints.length ? "Nothing in this filter" : "No complaints yet"}</p>
              <p className="mt-1 text-sm text-gray-500">{data.complaints.length ? "Try another filter." : "If something goes wrong with an order or the app, let us know here and we’ll follow up."}</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {visible.map((c) => (
                <li key={c._id}>
                  <button type="button" onClick={() => setSelectedId(c._id)} className="w-full text-left px-5 py-4 hover:bg-gray-50 flex items-start gap-4">
                    <span className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.target === "pharmacy" ? "bg-teal-50 text-teal-700" : "bg-blue-50 text-blue-700"}`}>{c.target === "pharmacy" ? <Building2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-gray-900 truncate">{c.subject}</span><StatusPill status={c.status} /></span>
                      <span className="block text-xs text-gray-500 mt-1"><span className="font-mono">{c.complaintId}</span> · To {c.target === "pharmacy" ? c.pharmacyName : "DawaConnect support"}{c.orderId ? ` · ${c.orderId}` : ""} · {c.messages?.length || 0} {c.messages?.length === 1 ? "reply" : "replies"} · Updated {formatDate(c.lastActivityAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}

export default function ComplaintsPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-gray-500">Loading…</div>}>
      <ComplaintsContent />
    </Suspense>
  );
}
