import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShoppingBag, Download, Building2, MapPin, Phone, User, Truck, Wallet, Receipt, PackageCheck, XCircle } from "lucide-react";
import { AdminAPI } from "../lib/api";
import { useQuery, useDebounced } from "../hooks/useQuery";
import { cn, downloadCsv, formatDateTime, formatMoney, formatNumber, formatRelative, ORDER_STATUSES } from "../lib/format";
import { PageHeader, Toolbar } from "../components/layout/PageHeader";
import { DataTable } from "../components/ui/DataTable";
import { Drawer } from "../components/ui/overlays";
import { Badge, Button, Card, EmptyState, KeyValue, SearchInput, Select, Skeleton, StatusBadge } from "../components/ui/primitives";
import { Stat } from "../components/layout/PageHeader";

const STEPS = ["Processing", "Confirmed", "Packed", "Dispatched", "Delivered"];

function Timeline({ status }) {
  const cancelled = status === "Cancelled";
  const idx = STEPS.indexOf(status === "Partially Delivered" ? "Delivered" : status);
  return (
    <ol className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const done = !cancelled && i <= idx;
        return (
          <li key={step} className="flex flex-1 items-center gap-1">
            <span className={cn("flex h-6 min-w-6 items-center justify-center rounded-full text-[10px] font-semibold", done ? "bg-brand-600 text-white" : cancelled ? "bg-red-100 text-red-500 dark:bg-red-950/50" : "bg-surface-3 text-subtle")} title={step}>{i + 1}</span>
            <span className={cn("hidden truncate text-[11px] sm:block", done ? "text-ink" : "text-subtle")}>{step}</span>
            {i < STEPS.length - 1 && <span className={cn("h-px flex-1", done && i < idx ? "bg-brand-500" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}

function OrderDrawer({ orderId, onClose }) {
  const { data, loading, error, refetch } = useQuery(() => AdminAPI.order(orderId), [orderId], { enabled: Boolean(orderId) });
  const order = data?.order;
  const customer = data?.customer;
  const address = order?.deliveryAddress;
  const pharmacyOrderById = new Map((data?.pharmacyOrders || []).map((po) => [po.id, po]));
  return (
    <Drawer open={Boolean(orderId)} onClose={onClose} loading={loading} width="max-w-3xl"
      eyebrow={<><span>Order</span>{order && <StatusBadge status={order.status} />}{order && <Badge tone="neutral">{order.paymentMethod === "card" ? "Card" : "Cash on delivery"}</Badge>}</>}
      title={order ? <span className="font-mono">{order.orderId}</span> : loading ? "Loading…" : "Order"}
      subtitle={order && `Placed ${formatDateTime(order.createdAt)} · ${formatRelative(order.createdAt)}`}>
      {error && <EmptyState title="Couldn’t load this order" description={error} action={<Button onClick={() => refetch()}>Retry</Button>} />}
      {order && (
        <div className="space-y-6 px-5 py-4 sm:px-6">
          <section className="rounded-xl border border-line p-4">
            <Timeline status={order.status} />
            {order.status === "Cancelled" && <p className="mt-3 flex items-center gap-1.5 text-xs text-red-600"><XCircle className="h-3.5 w-3.5" /> This order was cancelled. Reserved stock was restored to the pharmacy.</p>}
            {order.status === "Partially Delivered" && <p className="mt-3 text-xs text-amber-700">Some pharmacy fulfilments were delivered while others were cancelled.</p>}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-line p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><User className="h-4 w-4 text-muted" /> Customer</h3>
              {customer ? (
                <div className="text-sm"><Link to={`/customers?id=${customer._id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">{customer.name}</Link><p className="text-muted">{customer.email}</p>{customer.phone && <p className="text-muted">{customer.phone}</p>}</div>
              ) : <p className="text-sm text-muted">Guest checkout</p>}
            </section>
            <section className="rounded-xl border border-line p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><MapPin className="h-4 w-4 text-muted" /> Delivery address</h3>
              {address ? <div className="text-sm"><p className="font-medium text-ink">{address.fullName}{address.label ? <span className="ml-2 text-xs font-normal text-muted">({address.label})</span> : null}</p><p className="text-ink-2">{[address.line1, address.line2].filter(Boolean).join(", ")}</p><p className="text-muted">{[address.city, address.province, address.postalCode].filter(Boolean).join(", ")}</p>{address.phone && <p className="mt-1 inline-flex items-center gap-1 text-muted"><Phone className="h-3 w-3" />{address.phone}</p>}</div> : <p className="text-sm text-muted">—</p>}
            </section>
          </div>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Truck className="h-4 w-4 text-muted" /> Pharmacy fulfilments <span className="text-xs font-normal text-muted">{order.fulfillments?.length || 0}</span></h3>
            <div className="space-y-3">
              {(order.fulfillments || []).map((f) => {
                const po = pharmacyOrderById.get(f.pharmacyOrderId);
                const items = (order.items || []).filter((i) => i.pharmacyId === f.pharmacyId);
                return (
                  <div key={f.pharmacyOrderId || f.pharmacyId} className="rounded-xl border border-line">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
                      <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted" /><Link to={`/pharmacies?id=${f.pharmacyId}`} className="text-sm font-semibold text-ink hover:underline">{f.pharmacyName}</Link><span className="font-mono text-[11px] text-subtle">{f.pharmacyOrderId}</span></div>
                      <div className="flex items-center gap-2"><StatusBadge status={po?.status || f.status} /><span className="tabular text-sm font-semibold text-ink">{formatMoney(f.total)}</span></div>
                    </div>
                    <ul className="divide-y divide-line">
                      {items.map((item, i) => (
                        <li key={`${item.productId}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm"><span className="min-w-0"><span className="block truncate text-ink">{item.name}</span><span className="text-xs text-muted">{item.category}{item.unit ? ` · ${item.unit}` : ""} · {formatMoney(item.price)} × {item.quantity}</span></span><span className="tabular font-medium">{formatMoney(item.lineTotal ?? item.price * item.quantity)}</span></li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-muted"><span>Subtotal {formatMoney(f.subtotal)}</span><span>Tax {formatMoney(f.tax)}</span><span>Delivery {formatMoney(f.deliveryFee)}</span>{f.updatedAt && <span className="ml-auto">Updated {formatRelative(f.updatedAt)}</span>}</div>
                  </div>
                );
              })}
              {!order.fulfillments?.length && <p className="text-sm text-subtle">This order has no pharmacy fulfilments recorded.</p>}
            </div>
          </section>

          <section className="rounded-xl border border-line p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Receipt className="h-4 w-4 text-muted" /> Payment summary</h3>
            <KeyValue columns={3} items={[
              { label: "Subtotal", value: formatMoney(order.subtotal) }, { label: "Tax", value: formatMoney(order.tax) }, { label: "Delivery", value: formatMoney(order.deliveryFee) },
              { label: "Processing fee", value: formatMoney(order.processingFee) }, { label: "Total", value: <span className="text-base font-semibold">{formatMoney(order.total)}</span> }, { label: "Payment status", value: order.paymentStatus || "—" },
              { label: "Estimated delivery", value: order.estimatedDelivery ? formatDateTime(order.estimatedDelivery) : "—" }, { label: "Last updated", value: formatDateTime(order.updatedAt) }, { label: "Record ID", value: order._id, mono: true },
            ]} />
          </section>
        </div>
      )}
    </Drawer>
  );
}

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const { data, loading, error, refetch, updatedAt } = useQuery(() => AdminAPI.orders(1000), [], { pollMs: 30000 });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [pharmacy, setPharmacy] = useState("all");
  const [range, setRangeState] = useState("all");
  const [asOf, setAsOf] = useState(() => Date.now());
  const setRange = (value) => { setRangeState(value); setAsOf(Date.now()); };
  const debounced = useDebounced(query);
  const selectedId = params.get("id");

  const pharmacies = useMemo(() => { const map = new Map(); for (const o of data || []) for (const f of o.fulfillments || []) if (f.pharmacyId) map.set(f.pharmacyId, f.pharmacyName); return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1])); }, [data]);
  const rows = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    const since = range === "all" ? 0 : asOf - Number(range) * 86400000;
    return (data || []).filter((o) => (status === "all" || o.status === status) && (pharmacy === "all" || (o.fulfillments || []).some((f) => f.pharmacyId === pharmacy)) && (!since || new Date(o.createdAt).getTime() >= since)
      && (!needle || `${o.orderId} ${o.customer?.name || ""} ${o.customer?.email || ""} ${o.deliveryAddress?.fullName || ""} ${o.deliveryAddress?.city || ""} ${(o.fulfillments || []).map((f) => f.pharmacyName).join(" ")}`.toLowerCase().includes(needle)));
  }, [data, debounced, status, pharmacy, range, asOf]);

  const summary = useMemo(() => ({
    count: rows.length,
    revenue: rows.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + (Number(o.total) || 0), 0),
    delivered: rows.filter((o) => o.status === "Delivered").length,
    cancelled: rows.filter((o) => o.status === "Cancelled").length,
  }), [rows]);

  function openDrawer(id) { const next = new URLSearchParams(params); if (id) next.set("id", id); else next.delete("id"); setParams(next); }

  const columns = [
    { id: "orderId", header: "Order", sortable: true, accessor: (r) => r.orderId, cell: (r) => <div><p className="font-mono text-xs font-semibold text-ink">{r.orderId}</p><p className="text-[11px] text-subtle">{formatRelative(r.createdAt)}</p></div> },
    { id: "customer", header: "Customer", sortable: true, accessor: (r) => r.customer?.name || r.deliveryAddress?.fullName || "", cell: (r) => <div className="min-w-0"><p className="truncate text-ink">{r.customer?.name || r.deliveryAddress?.fullName || "Guest"}</p><p className="truncate text-xs text-muted">{r.customer?.email || (r.customer ? "" : "Guest checkout")}</p></div> },
    { id: "pharmacies", header: "Pharmacies", hideBelow: "md", accessor: (r) => (r.fulfillments || []).map((f) => f.pharmacyName).join(", "), cell: (r) => <div className="flex flex-wrap gap-1">{(r.fulfillments || []).slice(0, 2).map((f) => <Badge key={f.pharmacyId} tone="neutral">{f.pharmacyName}</Badge>)}{(r.fulfillments?.length || 0) > 2 && <Badge tone="neutral">+{r.fulfillments.length - 2}</Badge>}</div> },
    { id: "city", header: "City", sortable: true, accessor: (r) => r.deliveryAddress?.city || "", hideBelow: "lg", cell: (r) => <span className="text-ink-2">{r.deliveryAddress?.city || <span className="text-subtle">—</span>}</span> },
    { id: "items", header: "Items", align: "right", accessor: (r) => (r.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0), hideBelow: "xl", cell: (r) => <span className="tabular">{formatNumber((r.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0))}</span> },
    { id: "date", header: "Placed", sortable: true, accessor: (r) => new Date(r.createdAt || 0), hideBelow: "lg", cell: (r) => <span className="text-muted">{formatDateTime(r.createdAt)}</span> },
    { id: "status", header: "Status", sortable: true, accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: "total", header: "Total", sortable: true, accessor: (r) => Number(r.total) || 0, align: "right", cell: (r) => <span className="tabular font-semibold text-ink">{formatMoney(r.total)}</span> },
  ];

  return (
    <>
      <PageHeader title="Orders" description="Every Marketplace master order with its per-pharmacy fulfilments. Status is synchronised from the pharmacy app." onRefresh={refetch} refreshing={loading} updatedAt={updatedAt}
        actions={<Button variant="secondary" size="sm" disabled={!rows.length} onClick={() => downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, [
          { header: "Order ID", value: "orderId" }, { header: "Placed", value: (r) => formatDateTime(r.createdAt) }, { header: "Customer", value: (r) => r.customer?.name || r.deliveryAddress?.fullName || "Guest" }, { header: "Email", value: (r) => r.customer?.email || "" }, { header: "City", value: (r) => r.deliveryAddress?.city || "" }, { header: "Pharmacies", value: (r) => (r.fulfillments || []).map((f) => f.pharmacyName).join("; ") }, { header: "Status", value: "status" }, { header: "Payment", value: "paymentMethod" }, { header: "Subtotal", value: "subtotal" }, { header: "Tax", value: "tax" }, { header: "Delivery", value: "deliveryFee" }, { header: "Total", value: "total" },
        ], rows)}><Download className="h-3.5 w-3.5" /> Export CSV</Button>} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Orders (filtered)" value={formatNumber(summary.count)} icon={ShoppingBag} loading={loading && !data} />
        <Stat label="Revenue (non-cancelled)" value={formatMoney(summary.revenue)} icon={Wallet} tone="emerald" loading={loading && !data} />
        <Stat label="Delivered" value={formatNumber(summary.delivered)} icon={PackageCheck} tone="sky" loading={loading && !data} />
        <Stat label="Cancelled" value={formatNumber(summary.cancelled)} icon={XCircle} tone="rose" loading={loading && !data} />
      </div>

      <Card padded={false}>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search order ID, customer, pharmacy, city…" className="w-full sm:w-80" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9.5 w-full sm:w-44" aria-label="Filter by status"><option value="all">All statuses</option>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          <Select value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} className="h-9.5 w-full sm:w-52" aria-label="Filter by pharmacy"><option value="all">All pharmacies</option>{pharmacies.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select>
          <Select value={range} onChange={(e) => setRange(e.target.value)} className="h-9.5 w-full sm:w-36" aria-label="Date range"><option value="all">All time</option><option value="1">Last 24 h</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></Select>
        </Toolbar>
        {loading && !data ? <div className="p-4"><Skeleton className="h-64 w-full" /></div> : (
          <DataTable columns={columns} rows={rows} rowKey="_id" loading={loading} error={error} onRowClick={(r) => openDrawer(r._id)} selectedKey={selectedId} defaultSort={{ id: "date", dir: "desc" }} pageSize={20}
            emptyIcon={ShoppingBag} emptyTitle={data?.length ? "No orders match these filters" : "No orders yet"} emptyDescription={data?.length ? "Try widening the date range or clearing the search." : "Orders appear here as soon as customers check out on the Marketplace."} footerNote="Showing the most recent 1,000 orders" />
        )}
      </Card>

      <OrderDrawer orderId={selectedId} onClose={() => openDrawer(null)} />
    </>
  );
}
