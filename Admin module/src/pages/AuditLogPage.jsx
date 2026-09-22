import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ScrollText, Download, Building2, User, ShieldCheck, MessageSquareWarning, ShoppingBag } from "lucide-react";
import { AdminAPI } from "../lib/api";
import { useQuery, useDebounced } from "../hooks/useQuery";
import { downloadCsv, formatDateTime, formatRelative, titleCase } from "../lib/format";
import { PageHeader, Toolbar } from "../components/layout/PageHeader";
import { DataTable } from "../components/ui/DataTable";
import { Avatar, Badge, Button, Card, SearchInput, Select } from "../components/ui/primitives";

const TARGET_META = {
  pharmacy: { icon: Building2, tone: "brand", link: (id) => `/pharmacies?id=${id}` },
  customer: { icon: User, tone: "info", link: (id) => `/customers?id=${id}` },
  admin: { icon: ShieldCheck, tone: "violet", link: () => "/admins" },
  complaint: { icon: MessageSquareWarning, tone: "warning", link: (id) => `/complaints?id=${id}` },
  order: { icon: ShoppingBag, tone: "neutral", link: (id) => `/orders?id=${id}` },
};
const ACTION_TONE = (action) => /delete|reject|suspend|dismiss/.test(action) ? "danger" : /approve|reinstate|resolve|unsuspend/.test(action) ? "success" : "neutral";

export default function AuditLogPage() {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [targetType, setTargetType] = useState("all");
  const [range, setRangeState] = useState("all");
  const [asOf, setAsOf] = useState(() => Date.now());
  const setRange = (value) => { setRangeState(value); setAsOf(Date.now()); };
  const debounced = useDebounced(query);
  const { data, loading, error, refetch, updatedAt } = useQuery(() => AdminAPI.audit({ limit: 1000 }), []);

  const rows = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    const since = range === "all" ? 0 : asOf - Number(range) * 86400000;
    return (data?.entries || []).filter((e) => (action === "all" || e.action === action) && (targetType === "all" || e.targetType === targetType) && (!since || new Date(e.createdAt).getTime() >= since)
      && (!needle || `${e.summary} ${e.targetLabel} ${e.actor?.name} ${e.actor?.email} ${e.action} ${e.meta?.reason || ""}`.toLowerCase().includes(needle)));
  }, [data, debounced, action, targetType, range, asOf]);

  const columns = [
    { id: "when", header: "When", sortable: true, accessor: (r) => new Date(r.createdAt), width: 150, cell: (r) => <div><p className="text-ink">{formatRelative(r.createdAt)}</p><p className="text-[11px] text-subtle">{formatDateTime(r.createdAt)}</p></div> },
    { id: "actor", header: "Admin", sortable: true, accessor: (r) => r.actor?.name || "", cell: (r) => <div className="flex items-center gap-2"><Avatar name={r.actor?.name} size="xs" /><div className="min-w-0"><p className="truncate text-sm text-ink">{r.actor?.name || "Unknown"}</p><p className="truncate text-[11px] text-muted">{r.actor?.role}</p></div></div> },
    { id: "action", header: "Action", sortable: true, accessor: (r) => r.action, cell: (r) => <Badge tone={ACTION_TONE(r.action)}>{titleCase(r.action.split(".").pop())}</Badge> },
    { id: "summary", header: "Details", accessor: (r) => r.summary, cell: (r) => {
      const meta = TARGET_META[r.targetType] || TARGET_META.order;
      const Icon = meta.icon;
      return (
        <div className="min-w-0 max-w-xl">
          <p className="text-ink">{r.summary}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1"><Icon className="h-3 w-3" />{titleCase(r.targetType)}</span>
            {r.targetId && <Link to={meta.link(r.targetId)} className="text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>{r.targetLabel || r.targetId}</Link>}
            {r.meta?.reason && <span className="italic">“{r.meta.reason}”</span>}
            {r.meta?.previousState && <span>from {r.meta.previousState}</span>}
          </p>
        </div>
      ); } },
  ];

  return (
    <>
      <PageHeader title="Audit log" description="A permanent record of every state-changing action taken in this console — who did it, to what, and why." onRefresh={refetch} refreshing={loading} updatedAt={updatedAt}
        actions={<Button variant="secondary" size="sm" disabled={!rows.length} onClick={() => downloadCsv(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, [
          { header: "Time", value: (r) => formatDateTime(r.createdAt) }, { header: "Admin", value: (r) => r.actor?.name }, { header: "Email", value: (r) => r.actor?.email }, { header: "Action", value: "action" }, { header: "Target type", value: "targetType" }, { header: "Target", value: "targetLabel" }, { header: "Target ID", value: "targetId" }, { header: "Summary", value: "summary" }, { header: "Reason", value: (r) => r.meta?.reason || "" },
        ], rows)}><Download className="h-3.5 w-3.5" /> Export CSV</Button>} />

      <Card padded={false}>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search summary, admin, reason…" className="w-full sm:w-72" />
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="h-9.5 w-full sm:w-52" aria-label="Action"><option value="all">All actions</option>{(data?.actions || []).map((a) => <option key={a} value={a}>{a}</option>)}</Select>
          <Select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="h-9.5 w-full sm:w-40" aria-label="Target type"><option value="all">All targets</option>{Object.keys(TARGET_META).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>
          <Select value={range} onChange={(e) => setRange(e.target.value)} className="h-9.5 w-full sm:w-36" aria-label="Date range"><option value="all">All time</option><option value="1">Last 24 h</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></Select>
        </Toolbar>
        <DataTable columns={columns} rows={rows} rowKey="_id" loading={loading} error={error} defaultSort={{ id: "when", dir: "desc" }} pageSize={25} emptyIcon={ScrollText}
          emptyTitle={data?.entries?.length ? "No entries match" : "No admin actions recorded yet"} emptyDescription={data?.entries?.length ? "Try a wider date range or clear the filters." : "Approvals, rejections, suspensions, complaint updates and admin changes will be listed here."} footerNote="Most recent 1,000 entries" />
      </Card>
    </>
  );
}
