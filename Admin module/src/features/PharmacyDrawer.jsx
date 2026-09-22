import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, Building2, CheckCircle2, Clock3, Download, Mail, MapPin, MessageSquareWarning, Package, Phone, RotateCcw, ShoppingBag, Star, Truck, Wallet, XCircle, AlertTriangle, FileWarning } from "lucide-react";
import { AdminAPI } from "../lib/api";
import { useQuery } from "../hooks/useQuery";
import { useToast } from "../context/ToastContext";
import { useBadges } from "../context/BadgesContext";
import { cn, downloadCsv, formatDate, formatDateTime, formatMoney, formatNumber, formatRelative, PHARMACY_STATE_LABEL, COMPLAINT_STATUS_LABEL } from "../lib/format";
import { Drawer, ConfirmDialog } from "../components/ui/overlays";
import { Badge, Button, EmptyState, KeyValue, SearchInput, Skeleton, StatusBadge, Tabs } from "../components/ui/primitives";
import { DataTable } from "../components/ui/DataTable";

export function pharmacyStateBadge(state) {
  const tone = { approved: "success", pending: "warning", suspended: "danger", rejected: "danger" }[state] || "neutral";
  return <Badge tone={tone} dot>{PHARMACY_STATE_LABEL[state] || state}</Badge>;
}

/** Shared approve / reject / suspend / reinstate flows with confirmation + toasts. */
export function usePharmacyActions({ onDone } = {}) {
  const toast = useToast();
  const { refresh } = useBadges();
  const [dialog, setDialog] = useState(null); // { kind, pharmacy }

  async function run(kind, pharmacy, reason) {
    const id = pharmacy.id || pharmacy._id;
    let updated;
    if (kind === "approve" || kind === "reinstate") updated = await AdminAPI.approvePharmacy(id);
    else if (kind === "reject") updated = await AdminAPI.rejectPharmacy(id, reason);
    else if (kind === "suspend") updated = await AdminAPI.setPharmacyStatus(id, "suspended", reason);
    else if (kind === "revoke") updated = await AdminAPI.setPharmacyStatus(id, "unapproved", reason);
    const label = pharmacy.name || pharmacy.pharmacyName;
    const messages = {
      approve: ["Pharmacy approved", `${label} is now live on the Marketplace.`],
      reinstate: ["Pharmacy reinstated", `${label} can trade again.`],
      reject: ["Registration rejected", `${label} has been told why.`],
      suspend: ["Pharmacy suspended", `${label} was removed from the Marketplace.`],
      revoke: ["Moved back to pending", `${label} must be approved again before trading.`],
    };
    toast.success(...messages[kind]);
    refresh();
    onDone?.(updated, kind);
    return updated;
  }

  const dialogs = dialog && (
    <>
      <ConfirmDialog open={dialog.kind === "approve"} onClose={() => setDialog(null)} tone="success" icon={CheckCircle2} confirmLabel="Approve pharmacy" title={`Approve ${dialog.pharmacy.name}?`}
        description="Their inventory becomes visible on the Marketplace immediately and they can start receiving orders." onConfirm={() => run("approve", dialog.pharmacy)} />
      <ConfirmDialog open={dialog.kind === "reinstate"} onClose={() => setDialog(null)} tone="success" icon={CheckCircle2} confirmLabel="Reinstate" title={`Reinstate ${dialog.pharmacy.name}?`}
        description="The suspension is lifted and the pharmacy returns to the Marketplace." onConfirm={() => run("reinstate", dialog.pharmacy)} />
      <ConfirmDialog open={dialog.kind === "reject"} onClose={() => setDialog(null)} tone="danger" icon={XCircle} confirmLabel="Reject registration" title={`Reject ${dialog.pharmacy.name}?`}
        description="The pharmacy will see this reason inside their app. They keep their account but cannot manage inventory or receive orders."
        reason={{ label: "Reason shown to the pharmacy", required: true, minLength: 5, placeholder: "e.g. The licence number could not be verified with the provincial council. Please upload a clear photo of the licence." }}
        onConfirm={(reason) => run("reject", dialog.pharmacy, reason)} />
      <ConfirmDialog open={dialog.kind === "suspend"} onClose={() => setDialog(null)} tone="warning" icon={Ban} confirmLabel="Suspend pharmacy" title={`Suspend ${dialog.pharmacy.name}?`}
        description="Removes the pharmacy from the Marketplace and blocks its inventory and order workspaces until reinstated. Existing orders are not cancelled."
        reason={{ label: "Reason (shown to the pharmacy and recorded)", required: true, minLength: 5, placeholder: "e.g. Multiple verified complaints about expired stock" }}
        onConfirm={(reason) => run("suspend", dialog.pharmacy, reason)} />
      <ConfirmDialog open={dialog.kind === "revoke"} onClose={() => setDialog(null)} tone="warning" icon={RotateCcw} confirmLabel="Move to pending" title={`Revoke approval for ${dialog.pharmacy.name}?`}
        description="The pharmacy goes back to the review queue and is hidden from the Marketplace until approved again." reason={{ label: "Reason", required: false }} onConfirm={(reason) => run("revoke", dialog.pharmacy, reason)} />
    </>
  );

  return { open: (kind, pharmacy) => setDialog({ kind, pharmacy }), dialogs };
}

export function PharmacyActionButtons({ pharmacy, actions, size = "sm", compact = false }) {
  const state = pharmacy.state;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "pending" && <>
        <Button variant="success" size={size} onClick={() => actions.open("approve", pharmacy)}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>
        <Button variant="dangerOutline" size={size} onClick={() => actions.open("reject", pharmacy)}><XCircle className="h-3.5 w-3.5" /> Reject</Button>
      </>}
      {state === "approved" && <>
        <Button variant="secondary" size={size} className="text-amber-700 dark:text-amber-300" onClick={() => actions.open("suspend", pharmacy)}><Ban className="h-3.5 w-3.5" /> Suspend</Button>
        {!compact && <Button variant="ghost" size={size} onClick={() => actions.open("revoke", pharmacy)}><RotateCcw className="h-3.5 w-3.5" /> Revoke approval</Button>}
      </>}
      {state === "suspended" && <Button variant="success" size={size} onClick={() => actions.open("reinstate", pharmacy)}><CheckCircle2 className="h-3.5 w-3.5" /> Reinstate</Button>}
      {state === "rejected" && <Button variant="success" size={size} onClick={() => actions.open("approve", pharmacy)}><CheckCircle2 className="h-3.5 w-3.5" /> Approve anyway</Button>}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, tone }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className={cn("tabular mt-1 text-base font-semibold text-ink", tone === "danger" && "text-red-600 dark:text-red-400", tone === "warning" && "text-amber-600 dark:text-amber-400")}>{value}</p>
    </div>
  );
}

function stockTone(product) {
  const stock = Number(product.stock) || 0;
  const threshold = Number(product.threshold) || 0;
  if (stock <= 0) return "danger";
  if (stock <= threshold) return "warning";
  return "success";
}
function expiryState(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.ceil((date - Date.now()) / 86400000);
  if (days < 0) return { label: "Expired", tone: "danger" };
  if (days <= 30) return { label: `${days}d left`, tone: "warning" };
  return { label: formatDate(date), tone: "neutral" };
}

export function PharmacyDrawer({ pharmacyId, onClose, onChanged }) {
  const { data, loading, error, refetch, setData } = useQuery(() => AdminAPI.pharmacy360(pharmacyId), [pharmacyId], { enabled: Boolean(pharmacyId) });
  const [tab, setTab] = useState("overview");
  const [productQuery, setProductQuery] = useState("");
  const actions = usePharmacyActions({ onDone: (updated) => { setData((d) => (d ? { ...d, pharmacy: { ...d.pharmacy, ...updated } } : d)); onChanged?.(); } });
  const pharmacy = data?.pharmacy;
  const profile = data?.profile;
  const inventory = data?.inventory;

  const products = useMemo(() => {
    const list = data?.products || [];
    const needle = productQuery.trim().toLowerCase();
    return needle ? list.filter((p) => `${p.name} ${p.category} ${p.batch}`.toLowerCase().includes(needle)) : list;
  }, [data, productQuery]);

  const productColumns = [
    { id: "name", header: "Product", sortable: true, accessor: (r) => r.name, cell: (r) => <div><p className="font-medium text-ink">{r.name || "—"}</p><p className="text-xs text-muted">{r.category || "Uncategorised"}{r.unit ? ` · ${r.unit}` : ""}</p></div> },
    { id: "price", header: "Price", sortable: true, accessor: (r) => Number(r.price) || 0, align: "right", cell: (r) => <span className={cn("tabular", !(Number(r.price) > 0) && "text-red-600")}>{formatMoney(r.price)}</span> },
    { id: "stock", header: "Stock", sortable: true, accessor: (r) => Number(r.stock) || 0, align: "right", cell: (r) => <Badge tone={stockTone(r)}>{formatNumber(r.stock)}{r.threshold ? <span className="opacity-60"> / {r.threshold}</span> : null}</Badge> },
    { id: "expiry", header: "Expiry", sortable: true, accessor: (r) => new Date(r.expiry || 0), hideBelow: "md", cell: (r) => { const e = expiryState(r.expiry); return e ? <Badge tone={e.tone}>{e.label}</Badge> : <span className="text-subtle">—</span>; } },
    { id: "batch", header: "Batch", accessor: (r) => r.batch, hideBelow: "lg", cell: (r) => <span className="font-mono text-xs text-muted">{r.batch || "—"}</span> },
  ];

  const orderColumns = [
    { id: "id", header: "Order", sortable: true, accessor: (r) => r.id || r.marketplaceOrderId, cell: (r) => <div><p className="font-mono text-xs font-semibold text-ink">{r.id || "—"}</p>{r.source === "marketplace" && <Badge tone="brand" className="mt-1">Marketplace</Badge>}</div> },
    { id: "customer", header: "Customer", accessor: (r) => r.customer, cell: (r) => <span className="text-ink-2">{r.customer || "—"}</span> },
    { id: "date", header: "Date", sortable: true, accessor: (r) => new Date(r.createdAt || r.date || 0), hideBelow: "md", cell: (r) => <span className="text-muted">{formatDateTime(r.createdAt || r.date)}</span> },
    { id: "status", header: "Status", sortable: true, accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: "total", header: "Total", sortable: true, accessor: (r) => Number(r.total) || 0, align: "right", cell: (r) => <span className="tabular font-medium">{formatMoney(r.total)}</span> },
  ];

  const location = [pharmacy?.addressLine1, pharmacy?.area, pharmacy?.city, pharmacy?.province].filter(Boolean).join(", ");
  if (!pharmacyId) return null;

  return (
    <Drawer open={Boolean(pharmacyId)} onClose={onClose} loading={loading} width="max-w-4xl"
      eyebrow={<><span>Pharmacy</span>{pharmacy && pharmacyStateBadge(pharmacy.state)}{profile?.status && <Badge tone={profile.status === "Open" ? "success" : "neutral"}>{profile.status}</Badge>}</>}
      title={pharmacy ? <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-xl dark:bg-brand-950/60">{profile?.logo && profile.logo.length <= 3 ? profile.logo : <Building2 className="h-5 w-5 text-brand-600" />}</span>{profile?.name || pharmacy.name}</span> : loading ? "Loading…" : "Pharmacy"}
      subtitle={pharmacy && <span className="flex flex-wrap items-center gap-x-4 gap-y-1"><span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{pharmacy.email || "—"}</span><span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{profile?.phone || pharmacy.phone || "—"}</span>{location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{location}</span>}</span>}
      footer={pharmacy && <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted">Registered {formatRelative(pharmacy.createdAt)} · ID <span className="font-mono">{pharmacy.id}</span></span><PharmacyActionButtons pharmacy={pharmacy} actions={actions} /></div>}>
      {error && <EmptyState title="Couldn’t load this pharmacy" description={error} action={<Button onClick={() => refetch()}>Retry</Button>} />}
      {!error && (
        <div className="px-5 py-4 sm:px-6">
          {pharmacy?.state === "rejected" && pharmacy.rejectionReason && (
            <div className="mb-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"><FileWarning className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Rejected {formatRelative(pharmacy.rejectedAt)}</p><p className="mt-0.5">{pharmacy.rejectionReason}</p></div></div>
          )}
          {pharmacy?.state === "suspended" && (
            <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Suspended {formatRelative(pharmacy.suspendedAt)}</p><p className="mt-0.5">{pharmacy.suspensionReason || "No reason recorded."}</p></div></div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {!data ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />) : <>
              <MiniStat label="Products" value={formatNumber(inventory.total)} icon={Package} />
              <MiniStat label="Low / out of stock" value={`${inventory.lowStock} / ${inventory.outOfStock}`} icon={AlertTriangle} tone={inventory.outOfStock ? "danger" : inventory.lowStock ? "warning" : undefined} />
              <MiniStat label="Expiring ≤30d" value={formatNumber(inventory.expiringSoon + inventory.expired)} icon={Clock3} tone={inventory.expired ? "danger" : inventory.expiringSoon ? "warning" : undefined} />
              <MiniStat label="Fulfilments" value={formatNumber(data.fulfillmentStats.total)} icon={Truck} />
              <MiniStat label="Delivered revenue" value={formatMoney(data.fulfillmentStats.revenue)} icon={Wallet} />
              <MiniStat label="Rating" value={data.ratingSummary.average ? `${data.ratingSummary.average.toFixed(1)} ★ (${data.ratingSummary.count})` : "—"} icon={Star} />
            </>}
          </div>

          <Tabs className="mt-5" value={tab} onChange={setTab} tabs={[
            { value: "overview", label: "Overview" }, { value: "inventory", label: "Inventory", count: data?.inventory?.total }, { value: "orders", label: "Orders", count: data?.orders?.length },
            { value: "complaints", label: "Complaints", count: data?.complaints?.length }, { value: "feedback", label: "Reviews & returns", count: (data?.reviews?.length || 0) + (data?.returns?.length || 0) },
          ]} />

          {tab === "overview" && pharmacy && (
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <section>
                <h3 className="mb-3 text-sm font-semibold text-ink">Registration</h3>
                <KeyValue items={[
                  { label: "Pharmacy name", value: pharmacy.pharmacyName || pharmacy.name }, { label: "Owner", value: pharmacy.ownerName || "—" }, { label: "Licence number", value: pharmacy.license || "—", mono: true }, { label: "CNIC", value: pharmacy.cnic || "—", mono: true },
                  { label: "Email", value: pharmacy.email || "—" }, { label: "Phone", value: pharmacy.phone || "—" }, { label: "Address", value: location || "—" },
                  { label: "Coordinates", value: pharmacy.latitude != null && pharmacy.longitude != null ? `${Number(pharmacy.latitude).toFixed(5)}, ${Number(pharmacy.longitude).toFixed(5)}` : "Not set", mono: true },
                  { label: "Registered hours", value: pharmacy.openingTime && pharmacy.closingTime ? `${pharmacy.openingTime} – ${pharmacy.closingTime}` : "—" },
                  { label: "Registered", value: formatDateTime(pharmacy.createdAt) }, { label: "Approved", value: pharmacy.approvedAt ? formatDateTime(pharmacy.approvedAt) : "—" }, { label: "Raw status fields", value: <span className="font-mono text-xs">{pharmacy.status} / {pharmacy.approvalStatus}</span> },
                ]} />
              </section>
              <section>
                <h3 className="mb-3 text-sm font-semibold text-ink">Storefront profile <span className="ml-1 text-xs font-normal text-muted">managed by the pharmacy</span></h3>
                {profile ? (
                  <KeyValue items={[
                    { label: "Display name", value: profile.name }, { label: "Storefront status", value: profile.status || "—" }, { label: "Hours", value: profile.hours || "—" }, { label: "Delivery type", value: profile.deliveryType || "—" },
                    { label: "Delivery charge", value: formatMoney(profile.deliveryCharge) }, { label: "Delivery radius", value: profile.deliveryRadius != null ? `${profile.deliveryRadius} km` : "—" }, { label: "Tax rate", value: profile.taxRate != null ? `${profile.taxRate}%` : "—" },
                    { label: "Bank", value: profile.bankName ? `${profile.bankName}${profile.accountNo ? ` · ${profile.accountNo}` : ""}` : "—" }, { label: "Profile updated", value: formatDateTime(profile.updatedAt) },
                  ]} />
                ) : <p className="text-sm text-subtle">The pharmacy has not opened its app since registering, so no storefront profile exists yet.</p>}
                {inventory?.categories?.length > 0 && (
                  <div className="mt-6">
                    <h3 className="mb-2 text-sm font-semibold text-ink">Inventory by category</h3>
                    <div className="flex flex-wrap gap-1.5">{inventory.categories.slice(0, 12).map((c) => <Badge key={c.category} tone="neutral">{c.category} <span className="tabular opacity-60">{c.count}</span></Badge>)}</div>
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === "inventory" && data && (
            <div className="mt-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <SearchInput value={productQuery} onChange={setProductQuery} placeholder="Filter products…" className="w-full sm:w-72" />
                <div className="ml-auto flex flex-wrap gap-1.5 text-xs">
                  {inventory.missingPrice > 0 && <Badge tone="danger">{inventory.missingPrice} without price</Badge>}
                  <Badge tone="neutral">Stock value {formatMoney(inventory.stockValue)}</Badge>
                  <Button variant="secondary" size="xs" disabled={!products.length} onClick={() => downloadCsv(`inventory-${(pharmacy.name || "pharmacy").replace(/[^\w.-]+/g, "_")}.csv`, [
                    { header: "Name", value: "name" }, { header: "Category", value: "category" }, { header: "Unit", value: "unit" }, { header: "Price", value: "price" }, { header: "Stock", value: "stock" }, { header: "Threshold", value: "threshold" }, { header: "Batch", value: "batch" }, { header: "Expiry", value: (r) => formatDate(r.expiry) },
                  ], products)}><Download className="h-3 w-3" /> CSV</Button>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-line">
                <DataTable dense columns={productColumns} rows={products} rowKey="_id" pageSize={10} defaultSort={{ id: "stock", dir: "asc" }} emptyIcon={Package} emptyTitle="No products" emptyDescription="This pharmacy has not added inventory yet." />
              </div>
            </div>
          )}

          {tab === "orders" && data && (
            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              <DataTable dense columns={orderColumns} rows={data.orders} rowKey={(r) => String(r._id)} pageSize={10} defaultSort={{ id: "date", dir: "desc" }} emptyIcon={ShoppingBag} emptyTitle="No orders yet" emptyDescription="Fulfilment orders from the Marketplace will appear here." footerNote="Most recent 60 fulfilment orders" />
            </div>
          )}

          {tab === "complaints" && data && (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap gap-1.5 text-xs"><Badge tone={data.complaintStats.receivedOpen ? "warning" : "neutral"}>{data.complaintStats.receivedOpen} open from customers</Badge><Badge tone="neutral">{data.complaintStats.received} received total</Badge><Badge tone="neutral">{data.complaintStats.filed} filed to DawaConnect</Badge></div>
              {data.complaints.length === 0 && <EmptyState icon={MessageSquareWarning} title="No complaints involve this pharmacy" compact />}
              {data.complaints.map((c) => (
                <Link key={c._id} to={`/complaints?id=${c._id}&scope=${c.target === "admin" ? "inbox" : "oversight"}`} className="block rounded-xl border border-line p-3 transition hover:border-line-strong hover:bg-surface-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{c.subject}</span>
                    <div className="flex items-center gap-2"><Badge tone={c.source === "pharmacy" ? "brand" : "info"}>{c.source === "pharmacy" ? "Filed by pharmacy" : "From customer"}</Badge><StatusBadge status={c.status} label={COMPLAINT_STATUS_LABEL[c.status]} /></div>
                  </div>
                  <p className="mt-1 text-xs text-muted">{c.complaintId} · {c.reporter?.name} · {formatRelative(c.createdAt)}</p>
                </Link>
              ))}
            </div>
          )}

          {tab === "feedback" && data && (
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <section>
                <h3 className="mb-2 text-sm font-semibold text-ink">Reviews</h3>
                {data.reviews.length === 0 ? <p className="text-sm text-subtle">No reviews yet.</p> : (
                  <ul className="space-y-2">{data.reviews.map((r) => (
                    <li key={r._id} className="rounded-xl border border-line p-3 text-sm">
                      <div className="flex items-center justify-between gap-2"><span className="font-medium text-ink">{r.customer || r.customerName || "Customer"}</span><span className="inline-flex items-center gap-1 text-amber-500"><Star className="h-3.5 w-3.5 fill-current" />{r.rating ?? "—"}</span></div>
                      {r.comment && <p className="mt-1 text-ink-2">{r.comment}</p>}
                      <p className="mt-1 text-xs text-subtle">{formatDate(r.createdAt || r.date)}{r.source ? ` · ${r.source}` : ""}</p>
                    </li>
                  ))}</ul>
                )}
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold text-ink">Returns & refunds</h3>
                {data.returns.length === 0 ? <p className="text-sm text-subtle">No return requests.</p> : (
                  <ul className="space-y-2">{data.returns.map((r) => (
                    <li key={r._id} className="rounded-xl border border-line p-3 text-sm">
                      <div className="flex items-center justify-between gap-2"><span className="font-medium text-ink">{r.item || "Return"}{r.qty ? ` × ${r.qty}` : ""}</span><StatusBadge status={r.status} /></div>
                      <p className="mt-1 text-ink-2">{r.reason || "—"}</p>
                      <p className="mt-1 text-xs text-subtle">{r.customer || ""} · Order {r.orderId || "—"} · {formatMoney(r.refundAmount)}</p>
                    </li>
                  ))}</ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}
      {actions.dialogs}
    </Drawer>
  );
}
