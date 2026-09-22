import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MessageSquareWarning, Building2, User, Send, CheckCircle2, XCircle, RotateCcw, Eye, Flag, Inbox, Shield } from "lucide-react";
import { AdminAPI, errorMessage } from "../lib/api";
import { useQuery, useDebounced } from "../hooks/useQuery";
import { useToast } from "../context/ToastContext";
import { useBadges } from "../context/BadgesContext";
import { useAuth } from "../context/AuthContext";
import { cn, formatDateTime, formatRelative, COMPLAINT_CATEGORY_LABEL, COMPLAINT_STATUS_LABEL } from "../lib/format";
import { PageHeader, Toolbar } from "../components/layout/PageHeader";
import { DataTable } from "../components/ui/DataTable";
import { Drawer, ConfirmDialog } from "../components/ui/overlays";
import { Avatar, Badge, Button, Card, EmptyState, KeyValue, SearchInput, Segmented, Select, StatusBadge, Textarea } from "../components/ui/primitives";

const PRIORITY_TONE = { high: "danger", medium: "warning", low: "neutral" };
const ROLE_LABEL = { customer: "Customer", pharmacy: "Pharmacy", admin: "DawaConnect" };

export function PriorityBadge({ priority }) {
  return <Badge tone={PRIORITY_TONE[priority] || "neutral"}><Flag className="h-3 w-3" />{priority}</Badge>;
}

function Message({ message, mine }) {
  return (
    <li className={cn("flex gap-3", mine && "flex-row-reverse")}>
      <Avatar name={message.by?.name || message.by?.role} size="sm" emoji={message.by?.role === "admin" ? <Shield className="h-3.5 w-3.5" /> : undefined} tone={message.by?.role === "admin" ? "brand" : undefined} />
      <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm", mine ? "rounded-tr-sm bg-brand-600 text-white" : "rounded-tl-sm bg-surface-3 text-ink")}>
        <p className={cn("mb-1 text-[11px] font-semibold", mine ? "text-white/80" : "text-muted")}>{message.by?.name || ROLE_LABEL[message.by?.role]} <span className="font-normal opacity-70">· {ROLE_LABEL[message.by?.role] || message.by?.role}</span></p>
        <p className="whitespace-pre-wrap leading-6">{message.text}</p>
        <p className={cn("mt-1 text-[10px]", mine ? "text-white/70" : "text-subtle")}>{formatDateTime(message.at)}</p>
      </div>
    </li>
  );
}

function ComplaintDrawer({ complaintId, onClose, onChanged }) {
  const toast = useToast();
  const { admin } = useAuth();
  const { refresh } = useBadges();
  const { data: complaint, loading, error, refetch, setData } = useQuery(() => AdminAPI.complaint(complaintId), [complaintId], { enabled: Boolean(complaintId) });
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [dialog, setDialog] = useState(null); // 'resolved' | 'dismissed'
  const threadEnd = useRef(null);

  useEffect(() => { threadEnd.current?.scrollIntoView({ block: "end" }); }, [complaint?.messages?.length]);

  async function apply(updater, success) {
    try {
      const updated = await updater();
      setData(updated);
      onChanged?.(updated);
      refresh();
      if (success) toast.success(...success);
      return updated;
    } catch (err) {
      toast.error("Update failed", errorMessage(err));
      throw err;
    }
  }

  async function sendReply(event) {
    event?.preventDefault();
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    try { await apply(() => AdminAPI.replyComplaint(complaintId, text)); setReply(""); } catch { /* toast shown */ } finally { setSending(false); }
  }

  const isInbox = complaint?.target === "admin";
  const closed = ["resolved", "dismissed"].includes(complaint?.status);
  const involvedPharmacyId = complaint?.pharmacyId || (complaint?.source === "pharmacy" ? complaint?.reporter?.id : null);

  return (
    <Drawer open={Boolean(complaintId)} onClose={onClose} loading={loading} width="max-w-3xl"
      eyebrow={complaint && <><span className="font-mono normal-case tracking-normal">{complaint.complaintId}</span><StatusBadge status={complaint.status} label={COMPLAINT_STATUS_LABEL[complaint.status]} /><PriorityBadge priority={complaint.priority} /><Badge tone={isInbox ? "brand" : "info"}>{isInbox ? "To DawaConnect" : "Customer → pharmacy"}</Badge></>}
      title={complaint?.subject || (loading ? "Loading…" : "Complaint")}
      subtitle={complaint && <span>Filed by <strong className="font-medium text-ink">{complaint.reporter?.name}</strong> ({ROLE_LABEL[complaint.reporter?.role]}) · {formatRelative(complaint.createdAt)}{complaint.pharmacyName && <> · about <strong className="font-medium text-ink">{complaint.pharmacyName}</strong></>}</span>}
      actions={complaint && !closed && (
        <div className="hidden items-center gap-1.5 sm:flex">
          <Select value={complaint.priority} onChange={(e) => apply(() => AdminAPI.updateComplaint(complaintId, { priority: e.target.value }), ["Priority updated"])} className="h-8 w-28 py-0 text-xs" aria-label="Priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select>
          {complaint.status === "open" && <Button size="sm" variant="secondary" onClick={() => apply(() => AdminAPI.updateComplaint(complaintId, { status: "in_review" }), ["Marked as in review"])}><Eye className="h-3.5 w-3.5" /> Start review</Button>}
          <Button size="sm" variant="success" onClick={() => setDialog("resolved")}><CheckCircle2 className="h-3.5 w-3.5" /> Resolve</Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog("dismissed")}><XCircle className="h-3.5 w-3.5" /> Dismiss</Button>
        </div>
      )}
      footer={complaint && (closed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted">{complaint.status === "resolved" ? "Resolved" : "Dismissed"} by {complaint.resolution?.by?.name || "DawaConnect"} · {formatRelative(complaint.resolution?.at)}</span>
          <Button size="sm" variant="secondary" onClick={() => apply(() => AdminAPI.updateComplaint(complaintId, { status: "open" }), ["Complaint reopened"])}><RotateCcw className="h-3.5 w-3.5" /> Reopen</Button>
        </div>
      ) : (
        <form onSubmit={sendReply} className="flex items-end gap-2">
          <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={isInbox ? `Reply to ${complaint.reporter?.name}…` : "Add a note visible to the customer and pharmacy…"} maxLength={2000} className="flex-1"
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendReply(e); }} />
          <Button type="submit" loading={sending} disabled={!reply.trim()} aria-label="Send reply"><Send className="h-4 w-4" /> Send</Button>
        </form>
      ))}>
      {error && <EmptyState title="Couldn’t load this complaint" description={error} action={<Button onClick={() => refetch()}>Retry</Button>} />}
      {complaint && (
        <div className="px-5 py-4 sm:px-6">
          {!closed && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5 sm:hidden">
              {complaint.status === "open" && <Button size="sm" variant="secondary" onClick={() => apply(() => AdminAPI.updateComplaint(complaintId, { status: "in_review" }), ["Marked as in review"])}>Start review</Button>}
              <Button size="sm" variant="success" onClick={() => setDialog("resolved")}>Resolve</Button>
              <Button size="sm" variant="ghost" onClick={() => setDialog("dismissed")}>Dismiss</Button>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <div>
              <section className="rounded-xl border border-line p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Original complaint</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{complaint.description}</p>
              </section>
              <section className="mt-4">
                <h3 className="mb-3 text-sm font-semibold text-ink">Conversation <span className="text-xs font-normal text-muted">{complaint.messages?.length || 0}</span></h3>
                {complaint.messages?.length ? (
                  <ul className="space-y-3">{complaint.messages.map((m, i) => <Message key={i} message={m} mine={m.by?.role === "admin" && m.by?.id === admin?.id} />)}<li ref={threadEnd} /></ul>
                ) : <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">No replies yet. {isInbox ? "Your reply is sent to the reporter and shown inside their app." : "The pharmacy handles this thread; anything you write is visible to both sides."}</p>}
              </section>
            </div>
            <aside className="space-y-4">
              <section className="rounded-xl border border-line p-4">
                <h3 className="mb-3 text-sm font-semibold text-ink">Details</h3>
                <KeyValue columns={1} items={[
                  { label: "Category", value: COMPLAINT_CATEGORY_LABEL[complaint.category] || complaint.category },
                  { label: "Filed", value: formatDateTime(complaint.createdAt) },
                  { label: "Last activity", value: formatRelative(complaint.lastActivityAt) },
                  complaint.orderId && { label: "Order", value: <Link to={`/orders?id=${complaint.orderId}`} className="font-mono text-xs text-brand-700 hover:underline dark:text-brand-300">{complaint.orderId}</Link> },
                  complaint.resolution?.note && { label: "Resolution note", value: complaint.resolution.note },
                ]} />
              </section>
              <section className="rounded-xl border border-line p-4">
                <h3 className="mb-3 text-sm font-semibold text-ink">Reporter</h3>
                <div className="flex items-center gap-3"><Avatar name={complaint.reporter?.name} size="sm" /><div className="min-w-0 text-sm"><p className="truncate font-medium text-ink">{complaint.reporter?.name}</p><p className="truncate text-xs text-muted">{complaint.reporter?.email || ROLE_LABEL[complaint.reporter?.role]}</p></div></div>
                {complaint.reporter?.role === "customer" && complaint.reporter?.id && <Link to={`/customers?id=${complaint.reporter.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"><User className="h-3.5 w-3.5" /> Open customer</Link>}
              </section>
              {involvedPharmacyId && (
                <section className="rounded-xl border border-line p-4">
                  <h3 className="mb-2 text-sm font-semibold text-ink">Pharmacy involved</h3>
                  <p className="text-sm text-ink-2">{complaint.pharmacyName || complaint.reporter?.name}</p>
                  <Link to={`/pharmacies?id=${involvedPharmacyId}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"><Building2 className="h-3.5 w-3.5" /> Open pharmacy 360°</Link>
                </section>
              )}
            </aside>
          </div>
        </div>
      )}
      <ConfirmDialog open={dialog === "resolved"} onClose={() => setDialog(null)} tone="success" icon={CheckCircle2} confirmLabel="Mark resolved" title="Resolve this complaint?" description="The reporter is notified and the note below is added to the conversation."
        reason={{ label: "Resolution note (sent to the reporter)", required: true, minLength: 5, placeholder: "e.g. We contacted the pharmacy and a refund was issued on 12 Sept." }}
        onConfirm={(note) => apply(() => AdminAPI.updateComplaint(complaintId, { status: "resolved", resolutionNote: note }), ["Complaint resolved"])} />
      <ConfirmDialog open={dialog === "dismissed"} onClose={() => setDialog(null)} tone="warning" icon={XCircle} confirmLabel="Dismiss" title="Dismiss this complaint?" description="Use this for duplicates or complaints that don’t need action. The reporter sees your note."
        reason={{ label: "Why is it being dismissed?", required: true, minLength: 5 }}
        onConfirm={(note) => apply(() => AdminAPI.updateComplaint(complaintId, { status: "dismissed", resolutionNote: note }), ["Complaint dismissed"])} />
    </Drawer>
  );
}

export default function ComplaintsPage() {
  const [params, setParams] = useSearchParams();
  const scope = params.get("scope") === "oversight" ? "oversight" : "inbox";
  const selectedId = params.get("id");
  const [status, setStatus] = useState("active");
  const [source, setSource] = useState("all");
  const [priority, setPriority] = useState("all");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query);
  const { data, loading, error, refetch, updatedAt, setData } = useQuery(() => AdminAPI.complaints({ scope }), [scope], { pollMs: 30000 });

  const rows = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    return (data?.complaints || []).filter((c) =>
      (status === "all" || (status === "active" ? ["open", "in_review"].includes(c.status) : c.status === status))
      && (source === "all" || c.source === source) && (priority === "all" || c.priority === priority)
      && (!needle || `${c.complaintId} ${c.subject} ${c.description} ${c.reporter?.name || ""} ${c.reporter?.email || ""} ${c.pharmacyName || ""} ${c.orderId || ""}`.toLowerCase().includes(needle)));
  }, [data, debounced, status, source, priority]);

  function setParam(key, value) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next); }

  const columns = [
    { id: "subject", header: "Complaint", sortable: true, accessor: (r) => r.subject, cell: (r) => (
      <div className="min-w-0 max-w-md"><p className="truncate font-medium text-ink">{r.subject}</p><p className="truncate text-xs text-muted"><span className="font-mono">{r.complaintId}</span> · {COMPLAINT_CATEGORY_LABEL[r.category] || r.category}{r.orderId ? ` · ${r.orderId}` : ""}</p></div>) },
    { id: "reporter", header: "From", sortable: true, accessor: (r) => r.reporter?.name || "", cell: (r) => (
      <div className="flex items-center gap-2"><span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", r.source === "pharmacy" ? "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300" : "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300")}>{r.source === "pharmacy" ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}</span><div className="min-w-0"><p className="truncate text-sm text-ink">{r.reporter?.name}</p><p className="truncate text-[11px] text-muted">{r.source === "pharmacy" ? "Pharmacy" : "Customer"}</p></div></div>) },
    ...(scope === "oversight" ? [{ id: "pharmacy", header: "About", accessor: (r) => r.pharmacyName, hideBelow: "md", cell: (r) => <span className="text-ink-2">{r.pharmacyName || "—"}</span> }] : []),
    { id: "priority", header: "Priority", sortable: true, accessor: (r) => ({ high: 0, medium: 1, low: 2 })[r.priority] ?? 3, hideBelow: "md", cell: (r) => <PriorityBadge priority={r.priority} /> },
    { id: "replies", header: "Replies", align: "right", accessor: (r) => r.messages?.length || 0, hideBelow: "lg", cell: (r) => <span className="tabular text-muted">{r.messages?.length || 0}</span> },
    { id: "activity", header: "Last activity", sortable: true, accessor: (r) => new Date(r.lastActivityAt || r.createdAt || 0), hideBelow: "lg", cell: (r) => <span className="text-muted">{formatRelative(r.lastActivityAt || r.createdAt)}</span> },
    { id: "status", header: "Status", sortable: true, accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} label={COMPLAINT_STATUS_LABEL[r.status]} /> },
  ];

  return (
    <>
      <PageHeader title="Complaints" description="Pharmacies and customers can escalate to DawaConnect; customers can also complain directly to a pharmacy. Oversight shows those pharmacy-handled threads." onRefresh={refetch} refreshing={loading} updatedAt={updatedAt} />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Segmented value={scope} onChange={(v) => setParam("scope", v === "inbox" ? null : v)} options={[
            { value: "inbox", label: "Inbox · to DawaConnect", icon: Inbox, count: data?.counts?.inboxOpen },
            { value: "oversight", label: "Oversight · to pharmacies", icon: Building2, count: data?.counts?.oversightOpen },
          ]} />
        </div>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search subject, ID, reporter, order…" className="w-full sm:w-72" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9.5 w-full sm:w-40" aria-label="Status"><option value="active">Open + in review</option><option value="open">Open</option><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="all">All statuses</option></Select>
          {scope === "inbox" && <Select value={source} onChange={(e) => setSource(e.target.value)} className="h-9.5 w-full sm:w-40" aria-label="Source"><option value="all">From anyone</option><option value="pharmacy">From pharmacies</option><option value="customer">From customers</option></Select>}
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9.5 w-full sm:w-36" aria-label="Priority"><option value="all">Any priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select>
        </Toolbar>
        <DataTable columns={columns} rows={rows} rowKey="_id" loading={loading} error={error} onRowClick={(r) => setParam("id", r._id)} selectedKey={selectedId} defaultSort={{ id: "activity", dir: "desc" }}
          rowClassName={(r) => r.priority === "high" && ["open", "in_review"].includes(r.status) ? "border-l-2 border-l-red-500" : ""}
          emptyIcon={MessageSquareWarning} emptyTitle={data?.complaints?.length ? "No complaints match" : scope === "inbox" ? "Your inbox is clear" : "No customer → pharmacy complaints"}
          emptyDescription={data?.complaints?.length ? "Try another status or clear the search." : scope === "inbox" ? "Complaints filed by pharmacies (from their desktop app) and by customers choosing “DawaConnect support” on the Marketplace land here." : "When a customer complains about a specific pharmacy, the pharmacy handles it in its app and the thread is visible here for moderation."} />
      </Card>

      <ComplaintDrawer complaintId={selectedId} onClose={() => setParam("id", null)} onChanged={(updated) => setData((d) => (d ? { ...d, complaints: d.complaints.map((c) => (c._id === updated._id ? updated : c)) } : d))} />
    </>
  );
}
