import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Download, Eye, MoreHorizontal, CheckCircle2, XCircle, Ban, RotateCcw } from "lucide-react";
import { AdminAPI } from "../lib/api";
import { useQuery, useDebounced } from "../hooks/useQuery";
import { downloadCsv, formatDate, formatNumber, formatRelative } from "../lib/format";
import { PageHeader, Toolbar } from "../components/layout/PageHeader";
import { DataTable } from "../components/ui/DataTable";
import { Badge, Button, Card, Menu, SearchInput, Segmented, Select } from "../components/ui/primitives";
import { PharmacyDrawer, pharmacyStateBadge, usePharmacyActions } from "../features/PharmacyDrawer";

export default function PharmaciesPage() {
  const [params, setParams] = useSearchParams();
  const { data, loading, error, refetch, updatedAt, setData } = useQuery(() => AdminAPI.pharmacies(), []);
  const [query, setQuery] = useState("");
  const [state, setState] = useState(params.get("state") || "all");
  const [city, setCity] = useState("all");
  const debounced = useDebounced(query);
  const selectedId = params.get("id");
  const actions = usePharmacyActions({ onDone: (updated) => setData((list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))) });

  const cities = useMemo(() => [...new Set((data || []).map((p) => p.city).filter(Boolean))].sort(), [data]);
  const rows = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    return (data || []).filter((p) => (state === "all" || p.state === state) && (city === "all" || p.city === city)
      && (!needle || `${p.name} ${p.displayName || ""} ${p.ownerName || ""} ${p.email || ""} ${p.phone || ""} ${p.city || ""} ${p.license || ""}`.toLowerCase().includes(needle)));
  }, [data, debounced, state, city]);
  const counts = useMemo(() => ["all", "approved", "pending", "suspended", "rejected"].reduce((acc, key) => ({ ...acc, [key]: key === "all" ? data?.length || 0 : data?.filter((p) => p.state === key).length || 0 }), {}), [data]);

  function openDrawer(id) { const next = new URLSearchParams(params); if (id) next.set("id", id); else next.delete("id"); setParams(next); }

  const columns = [
    { id: "name", header: "Pharmacy", sortable: true, accessor: (r) => r.displayName || r.name, cell: (r) => (
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-base dark:bg-brand-950/60">{r.logo && r.logo.length <= 3 ? r.logo : <Building2 className="h-4 w-4 text-brand-600" />}</span>
        <div className="min-w-0"><p className="truncate font-medium text-ink">{r.displayName || r.name}</p><p className="truncate text-xs text-muted">{r.ownerName ? `${r.ownerName} · ` : ""}{r.email || "—"}</p></div>
      </div>) },
    { id: "city", header: "City", sortable: true, accessor: (r) => r.city || "", hideBelow: "md", cell: (r) => <span className="text-ink-2">{r.city || <span className="text-subtle">—</span>}{r.area ? <span className="block text-xs text-muted">{r.area}</span> : null}</span> },
    { id: "license", header: "Licence", accessor: (r) => r.license, hideBelow: "lg", cell: (r) => <span className="font-mono text-xs text-ink-2">{r.license || <span className="text-subtle">—</span>}</span> },
    { id: "products", header: "Products", sortable: true, accessor: (r) => r.productCount, align: "right", cell: (r) => <span className="tabular">{formatNumber(r.productCount)}</span> },
    { id: "storefront", header: "Storefront", accessor: (r) => r.storefrontStatus || "", hideBelow: "xl", cell: (r) => r.storefrontStatus ? <Badge tone={r.storefrontStatus === "Open" ? "success" : "neutral"}>{r.storefrontStatus}</Badge> : <span className="text-subtle">—</span> },
    { id: "registered", header: "Registered", sortable: true, accessor: (r) => new Date(r.createdAt || 0), hideBelow: "lg", cell: (r) => <span className="text-muted" title={formatDate(r.createdAt)}>{formatRelative(r.createdAt)}</span> },
    { id: "state", header: "Status", sortable: true, accessor: (r) => r.state, cell: (r) => pharmacyStateBadge(r.state) },
    { id: "actions", header: "", align: "right", width: 48, cell: (r) => (
      <Menu trigger={<Button variant="ghost" size="iconSm" aria-label={`Actions for ${r.name}`}><MoreHorizontal className="h-4 w-4" /></Button>} items={[
        { label: "View 360°", icon: Eye, onClick: () => openDrawer(r.id) },
        "divider",
        r.state === "pending" && { label: "Approve", icon: CheckCircle2, onClick: () => actions.open("approve", r) },
        r.state === "pending" && { label: "Reject…", icon: XCircle, danger: true, onClick: () => actions.open("reject", r) },
        r.state === "approved" && { label: "Suspend…", icon: Ban, danger: true, onClick: () => actions.open("suspend", r) },
        r.state === "approved" && { label: "Revoke approval…", icon: RotateCcw, onClick: () => actions.open("revoke", r) },
        r.state === "suspended" && { label: "Reinstate", icon: CheckCircle2, onClick: () => actions.open("reinstate", r) },
        r.state === "rejected" && { label: "Approve anyway", icon: CheckCircle2, onClick: () => actions.open("approve", r) },
      ]} />) },
  ];

  return (
    <>
      <PageHeader title="Pharmacies" description="Every pharmacy registered through the desktop app, with live inventory counts from the Pharmacy database." onRefresh={refetch} refreshing={loading} updatedAt={updatedAt}
        actions={<Button variant="secondary" size="sm" disabled={!rows.length} onClick={() => downloadCsv(`pharmacies-${new Date().toISOString().slice(0, 10)}.csv`, [
          { header: "Name", value: (r) => r.displayName || r.name }, { header: "Owner", value: "ownerName" }, { header: "Email", value: "email" }, { header: "Phone", value: "phone" }, { header: "City", value: "city" }, { header: "Province", value: "province" }, { header: "Licence", value: "license" }, { header: "Status", value: "state" }, { header: "Products", value: "productCount" }, { header: "Registered", value: (r) => formatDate(r.createdAt) },
        ], rows)}><Download className="h-3.5 w-3.5" /> Export CSV</Button>} />

      <Card padded={false}>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, owner, email, licence…" className="w-full sm:w-80" />
          <Select value={city} onChange={(e) => setCity(e.target.value)} className="h-9.5 w-full sm:w-44" aria-label="Filter by city"><option value="all">All cities</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          <Segmented className="ml-auto" size="sm" value={state} onChange={setState} options={[{ value: "all", label: "All", count: counts.all }, { value: "approved", label: "Approved", count: counts.approved }, { value: "pending", label: "Pending", count: counts.pending }, { value: "suspended", label: "Suspended", count: counts.suspended }, { value: "rejected", label: "Rejected", count: counts.rejected }]} />
        </Toolbar>
        <DataTable columns={columns} rows={rows} rowKey="id" loading={loading} error={error} onRowClick={(r) => openDrawer(r.id)} selectedKey={selectedId} defaultSort={{ id: "registered", dir: "desc" }}
          emptyIcon={Building2} emptyTitle={debounced || state !== "all" || city !== "all" ? "No pharmacies match" : "No pharmacies registered yet"} emptyDescription={debounced || state !== "all" || city !== "all" ? "Try a different search or filter." : "Pharmacies appear here once they register from the DawaConnect desktop app."} />
      </Card>

      <PharmacyDrawer pharmacyId={selectedId} onClose={() => openDrawer(null)} onChanged={() => refetch({ silent: true })} />
      {actions.dialogs}
    </>
  );
}
