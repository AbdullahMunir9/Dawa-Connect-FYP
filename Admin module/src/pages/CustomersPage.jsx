import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Users, Eye, Ban, CheckCircle2, MoreHorizontal } from "lucide-react";
import { AdminAPI } from "../lib/api";
import { useQuery, useDebounced } from "../hooks/useQuery";
import { useToast } from "../context/ToastContext";
import { downloadCsv, formatDate, formatMoney, formatNumber, formatRelative } from "../lib/format";
import { PageHeader, Toolbar } from "../components/layout/PageHeader";
import { DataTable } from "../components/ui/DataTable";
import { Avatar, Button, Card, Menu, SearchInput, Segmented, StatusBadge } from "../components/ui/primitives";
import { CustomerDrawer } from "../features/CustomerDrawer";

export default function CustomersPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, refetch, updatedAt, setData } = useQuery(() => AdminAPI.customers(), []);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const debounced = useDebounced(query);
  const selectedId = params.get("id");

  const rows = useMemo(() => {
    const list = data || [];
    const needle = debounced.trim().toLowerCase();
    return list.filter((c) => (filter === "all" || c.status === filter) && (!needle || `${c.name} ${c.email} ${c.phone || ""} ${c.city || ""}`.toLowerCase().includes(needle)));
  }, [data, debounced, filter]);

  const counts = useMemo(() => ({ all: data?.length || 0, active: data?.filter((c) => c.status === "active").length || 0, suspended: data?.filter((c) => c.status === "suspended").length || 0 }), [data]);

  function openDrawer(id) { setParams(id ? { id } : {}, { replace: false }); }

  async function quickToggle(customer) {
    const next = customer.status === "suspended" ? "active" : "suspended";
    try {
      const updated = await AdminAPI.setCustomerStatus(customer.id, next, "");
      setData((list) => list.map((c) => (c.id === customer.id ? { ...c, ...updated } : c)));
      toast.success(next === "suspended" ? "Customer suspended" : "Customer reactivated", updated.name);
    } catch (err) {
      toast.error("Action failed", err.response?.data?.message || err.message);
    }
  }

  const columns = [
    { id: "name", header: "Customer", sortable: true, accessor: (r) => r.name, cell: (r) => (
      <div className="flex items-center gap-3"><Avatar name={r.name} size="sm" /><div className="min-w-0"><p className="truncate font-medium text-ink">{r.name}</p><p className="truncate text-xs text-muted">{r.email}</p></div></div>) },
    { id: "city", header: "City", sortable: true, accessor: (r) => r.city || "", hideBelow: "md", cell: (r) => <span className="text-ink-2">{r.city || <span className="text-subtle">—</span>}</span> },
    { id: "phone", header: "Phone", accessor: (r) => r.phone || "", hideBelow: "lg", cell: (r) => <span className="tabular text-ink-2">{r.phone || <span className="text-subtle">—</span>}</span> },
    { id: "orders", header: "Orders", sortable: true, accessor: (r) => r.orderCount, align: "right", cell: (r) => <span className="tabular">{formatNumber(r.orderCount)}</span> },
    { id: "spent", header: "Spent", sortable: true, accessor: (r) => r.totalSpent, align: "right", hideBelow: "md", cell: (r) => <span className="tabular">{formatMoney(r.totalSpent)}</span> },
    { id: "joined", header: "Joined", sortable: true, accessor: (r) => new Date(r.createdAt || 0), hideBelow: "xl", cell: (r) => <span className="text-muted" title={formatDate(r.createdAt)}>{formatRelative(r.createdAt)}</span> },
    { id: "status", header: "Status", sortable: true, accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: "actions", header: "", align: "right", width: 48, cell: (r) => (
      <Menu trigger={<Button variant="ghost" size="iconSm" aria-label={`Actions for ${r.name}`}><MoreHorizontal className="h-4 w-4" /></Button>} items={[
        { label: "View details", icon: Eye, onClick: () => openDrawer(r.id) },
        r.status === "suspended" ? { label: "Reactivate", icon: CheckCircle2, onClick: () => quickToggle(r) } : { label: "Suspend", icon: Ban, onClick: () => quickToggle(r) },
      ]} />) },
  ];

  return (
    <>
      <PageHeader title="Customers" description="Marketplace customer accounts. Suspending a customer blocks Marketplace sign-in and checkout." onRefresh={refetch} refreshing={loading} updatedAt={updatedAt}
        actions={<Button variant="secondary" size="sm" disabled={!rows.length} onClick={() => downloadCsv(`customers-${new Date().toISOString().slice(0, 10)}.csv`, [
          { header: "Name", value: "name" }, { header: "Email", value: "email" }, { header: "Phone", value: "phone" }, { header: "City", value: "city" }, { header: "Status", value: "status" }, { header: "Orders", value: "orderCount" }, { header: "Spent (Rs)", value: "totalSpent" }, { header: "Joined", value: (r) => formatDate(r.createdAt) },
        ], rows)}><Download className="h-3.5 w-3.5" /> Export CSV</Button>} />

      <Card padded={false}>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, phone, city…" className="w-full sm:w-80" />
          <Segmented className="ml-auto" size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: "All", count: counts.all }, { value: "active", label: "Active", count: counts.active }, { value: "suspended", label: "Suspended", count: counts.suspended }]} />
        </Toolbar>
        <DataTable columns={columns} rows={rows} rowKey="id" loading={loading} error={error} onRowClick={(r) => openDrawer(r.id)} selectedKey={selectedId} defaultSort={{ id: "joined", dir: "desc" }}
          emptyIcon={Users} emptyTitle={debounced || filter !== "all" ? "No customers match" : "No customers yet"} emptyDescription={debounced || filter !== "all" ? "Try a different search or filter." : "Customer accounts appear here as soon as people sign up on the Marketplace."} />
      </Card>

      <CustomerDrawer customerId={selectedId} onClose={() => openDrawer(null)} onChanged={() => refetch({ silent: true })} />
    </>
  );
}
