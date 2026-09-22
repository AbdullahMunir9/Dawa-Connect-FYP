import { useState } from "react";
import { Link } from "react-router-dom";
import { Ban, CheckCircle2, Mail, MapPin, MessageSquareWarning, Phone, ShoppingBag, Trash2, Wallet, Calendar } from "lucide-react";
import { AdminAPI } from "../lib/api";
import { useQuery } from "../hooks/useQuery";
import { useToast } from "../context/ToastContext";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatRelative, COMPLAINT_STATUS_LABEL } from "../lib/format";
import { Drawer, ConfirmDialog } from "../components/ui/overlays";
import { Avatar, Badge, Button, EmptyState, KeyValue, Skeleton, StatusBadge, Tabs } from "../components/ui/primitives";

function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className="tabular mt-1 text-base font-semibold text-ink">{value}</p>
    </div>
  );
}

export function CustomerDrawer({ customerId, onClose, onChanged }) {
  const toast = useToast();
  const { data, loading, error, refetch, setData } = useQuery(() => AdminAPI.customer360(customerId), [customerId], { enabled: Boolean(customerId) });
  const [tab, setTab] = useState("overview");
  const [confirm, setConfirm] = useState(null); // 'suspend' | 'activate' | 'delete'
  const customer = data?.customer;
  const suspended = customer?.status === "suspended";
  if (!customerId) return null;

  async function changeStatus(next, reason) {
    const updated = await AdminAPI.setCustomerStatus(customerId, next, reason);
    setData((d) => (d ? { ...d, customer: { ...d.customer, ...updated } } : d));
    toast.success(next === "suspended" ? "Customer suspended" : "Customer reactivated", `${updated.name} ${next === "suspended" ? "can no longer sign in to the Marketplace." : "can sign in again."}`);
    onChanged?.();
  }

  async function remove(reason) {
    await AdminAPI.deleteCustomer(customerId, reason);
    toast.success("Customer deleted", `${customer?.name}’s account was removed.`);
    onChanged?.();
    onClose();
  }

  return (
    <Drawer open={Boolean(customerId)} onClose={onClose} loading={loading} width="max-w-3xl"
      eyebrow={<><span>Customer</span>{customer && <StatusBadge status={customer.status} />}</>}
      title={customer ? <span className="flex items-center gap-3"><Avatar name={customer.name} size="md" />{customer.name}</span> : loading ? "Loading…" : "Customer"}
      subtitle={customer && <span className="flex flex-wrap items-center gap-x-4 gap-y-1"><span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>{customer.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>}{customer.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{customer.city}</span>}</span>}
      footer={customer && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="dangerOutline" size="sm" onClick={() => setConfirm("delete")}><Trash2 className="h-3.5 w-3.5" /> Delete account</Button>
          {suspended
            ? <Button variant="success" size="sm" onClick={() => setConfirm("activate")}><CheckCircle2 className="h-3.5 w-3.5" /> Reactivate</Button>
            : <Button variant="secondary" size="sm" className="text-amber-700 dark:text-amber-300" onClick={() => setConfirm("suspend")}><Ban className="h-3.5 w-3.5" /> Suspend</Button>}
        </div>
      )}>
      {error && <EmptyState title="Couldn’t load this customer" description={error} action={<Button onClick={() => refetch()}>Retry</Button>} />}
      {!error && (
        <div className="px-5 py-4 sm:px-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {!data ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />) : <>
              <MiniStat label="Orders" value={formatNumber(data.stats.orders)} icon={ShoppingBag} />
              <MiniStat label="Delivered spend" value={formatMoney(data.stats.totalSpent)} icon={Wallet} />
              <MiniStat label="Last order" value={data.stats.lastOrderAt ? formatRelative(data.stats.lastOrderAt) : "—"} icon={Calendar} />
              <MiniStat label="Open complaints" value={formatNumber(data.stats.openComplaints)} icon={MessageSquareWarning} />
            </>}
          </div>

          <Tabs className="mt-5" value={tab} onChange={setTab} tabs={[{ value: "overview", label: "Overview" }, { value: "orders", label: "Orders", count: data?.orders?.length }, { value: "complaints", label: "Complaints", count: data?.complaints?.length }]} />

          {tab === "overview" && customer && (
            <div className="mt-5 space-y-6">
              <section>
                <h3 className="mb-3 text-sm font-semibold text-ink">Account</h3>
                <KeyValue items={[
                  { label: "Full name", value: customer.name }, { label: "Email", value: customer.email }, { label: "Phone", value: customer.phone || "—" }, { label: "City", value: customer.city || "—" },
                  { label: "Status", value: <StatusBadge status={customer.status} /> }, { label: "Joined", value: formatDateTime(customer.createdAt) }, { label: "Customer ID", value: customer.id, mono: true },
                ]} />
              </section>
              <section>
                <h3 className="mb-3 text-sm font-semibold text-ink">Saved addresses <span className="ml-1 text-xs font-normal text-muted">{customer.addresses?.length || 0}</span></h3>
                {customer.addresses?.length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {customer.addresses.map((a, i) => (
                      <li key={a._id || i} className="rounded-xl border border-line p-3 text-sm">
                        <div className="flex items-center justify-between gap-2"><span className="font-medium text-ink">{a.label || "Address"}</span>{a.isDefault && <Badge tone="brand">Default</Badge>}</div>
                        <p className="mt-1 text-ink-2">{a.fullName}{a.phone ? ` · ${a.phone}` : ""}</p>
                        <p className="text-muted">{[a.line1, a.line2, a.city, a.province, a.postalCode].filter(Boolean).join(", ")}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-subtle">No saved addresses.</p>}
              </section>
            </div>
          )}

          {tab === "orders" && (
            <div className="mt-4 space-y-2">
              {data?.orders?.length === 0 && <EmptyState icon={ShoppingBag} title="No orders yet" compact />}
              {data?.orders?.map((order) => (
                <Link key={order._id} to={`/orders?id=${order._id}`} className="block rounded-xl border border-line p-3 transition hover:border-line-strong hover:bg-surface-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">{order.orderId}</span>
                    <div className="flex items-center gap-2"><StatusBadge status={order.status} /><span className="tabular text-sm font-semibold text-ink">{formatMoney(order.total)}</span></div>
                  </div>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(order.createdAt)} · {order.items?.length || 0} items · {(order.fulfillments || []).map((f) => f.pharmacyName).join(", ")}</p>
                </Link>
              ))}
            </div>
          )}

          {tab === "complaints" && (
            <div className="mt-4 space-y-2">
              {data?.complaints?.length === 0 && <EmptyState icon={MessageSquareWarning} title="No complaints filed" compact />}
              {data?.complaints?.map((c) => (
                <Link key={c._id} to={`/complaints?id=${c._id}&scope=${c.target === "admin" ? "inbox" : "oversight"}`} className="block rounded-xl border border-line p-3 transition hover:border-line-strong hover:bg-surface-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{c.subject}</span>
                    <div className="flex items-center gap-2"><Badge tone="neutral">{c.target === "admin" ? "To DawaConnect" : `To ${c.pharmacyName || "pharmacy"}`}</Badge><StatusBadge status={c.status} label={COMPLAINT_STATUS_LABEL[c.status]} /></div>
                  </div>
                  <p className="mt-1 text-xs text-muted">{c.complaintId} · {formatDate(c.createdAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog open={confirm === "suspend"} onClose={() => setConfirm(null)} tone="warning" confirmLabel="Suspend customer" title={`Suspend ${customer?.name}?`}
        description="They will be signed out of the Marketplace and blocked from logging in or checking out until reactivated." reason={{ label: "Reason (recorded in the audit log)", required: false, placeholder: "e.g. Repeated fraudulent cash-on-delivery orders" }}
        onConfirm={(reason) => changeStatus("suspended", reason)} />
      <ConfirmDialog open={confirm === "activate"} onClose={() => setConfirm(null)} tone="success" confirmLabel="Reactivate" icon={CheckCircle2} title={`Reactivate ${customer?.name}?`} description="The customer will be able to sign in and place orders again." onConfirm={() => changeStatus("active", "")} />
      <ConfirmDialog open={confirm === "delete"} onClose={() => setConfirm(null)} tone="danger" confirmLabel="Delete permanently" title={`Delete ${customer?.name}’s account?`}
        description="This removes the customer record from the Marketplace. Their past orders remain for accounting but will show as a guest. This cannot be undone." reason={{ label: "Type a reason", required: true, minLength: 5 }} onConfirm={remove} />
    </Drawer>
  );
}
