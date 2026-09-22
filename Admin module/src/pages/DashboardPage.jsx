import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, Building2, ShoppingBag, Wallet, ClipboardCheck, MessageSquareWarning, ShieldCheck, ArrowRight, CheckCircle2, XCircle, Clock3, Truck, Package, PackageCheck, AlertTriangle, ScrollText } from "lucide-react";
import { AdminAPI } from "../lib/api";
import { useQuery } from "../hooks/useQuery";
import { useAuth } from "../context/AuthContext";
import { formatMoney, formatNumber, formatRelative, percentChange, cn, STATUS_COLOR } from "../lib/format";
import { PageHeader, Stat } from "../components/layout/PageHeader";
import { Badge, Button, Card, CardHeader, Delta, EmptyState, Segmented, Skeleton, StatusBadge } from "../components/ui/primitives";
import { BarList, CategoryBars, TrendChart } from "../components/ui/charts";

const ORDER_STATUS_META = {
  Processing: { icon: Clock3, color: STATUS_COLOR.warning },
  Confirmed: { icon: CheckCircle2, color: "#2a78d6" },
  Packed: { icon: Package, color: "#4a3aa7" },
  Dispatched: { icon: Truck, color: "#1baf7a" },
  Delivered: { icon: PackageCheck, color: STATUS_COLOR.good },
  "Partially Delivered": { icon: AlertTriangle, color: STATUS_COLOR.serious },
  Cancelled: { icon: XCircle, color: STATUS_COLOR.critical },
};
const ORDER_STATUS_ORDER = Object.keys(ORDER_STATUS_META);

function AttentionItem({ to, icon: Icon, count, label, tone }) {
  const tones = { amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300", sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300", violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" };
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:border-line-strong hover:bg-surface-2">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tones[tone])}><Icon className="h-4.5 w-4.5" /></span>
      <span className="min-w-0 flex-1"><span className="tabular block text-lg font-semibold leading-tight text-ink">{count}</span><span className="block truncate text-xs text-muted">{label}</span></span>
      <ArrowRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
  );
}

export default function DashboardPage() {
  const { admin, isSuperadmin } = useAuth();
  const { data, loading, error, refetch, updatedAt } = useQuery(() => AdminAPI.dashboard(), [], { pollMs: 60000 });
  const [trend, setTrend] = useState("orders");

  const orders = data?.orders;
  const ordersDelta = percentChange(orders?.last30, orders?.prev30);
  const revenueDelta = percentChange(orders?.revenue30, orders?.revenuePrev30);
  const statusItems = ORDER_STATUS_ORDER
    .map((status) => ({ label: status, value: orders?.byStatus?.find((s) => s.status === status)?.count || 0, icon: ORDER_STATUS_META[status].icon, color: ORDER_STATUS_META[status].color }))
    .filter((s) => s.value > 0);
  const attention = data ? [
    { to: "/approvals", icon: ClipboardCheck, count: data.pharmacies.pending, label: "Pharmacies awaiting review", tone: "amber" },
    { to: "/complaints", icon: MessageSquareWarning, count: data.complaints.open + data.complaints.inReview, label: "Open complaints in your inbox", tone: "rose" },
    { to: "/complaints?scope=oversight", icon: Building2, count: data.complaints.oversightOpen, label: "Customer→pharmacy complaints", tone: "sky" },
    isSuperadmin && { to: "/admins", icon: ShieldCheck, count: data.pendingAdmins, label: "Admin accounts pending approval", tone: "violet" },
  ].filter(Boolean) : [];
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader title={`${greeting}, ${admin?.name?.split(" ")[0] || "there"}`} description="Here’s what’s happening across the DawaConnect marketplace." onRefresh={refetch} refreshing={loading} updatedAt={updatedAt} />

      {error && !data && (
        <Card className="mb-5"><EmptyState icon={AlertTriangle} title="Couldn’t load the dashboard" description={error} action={<Button onClick={() => refetch()}>Try again</Button>} /></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Orders · last 30 days" value={formatNumber(orders?.last30)} loading={loading && !data} icon={ShoppingBag} tone="brand" delta={data && <Delta value={ordersDelta} />} hint={`${formatNumber(orders?.total)} all-time · ${formatNumber(orders?.active)} in progress`} />
        <Stat label="Revenue · last 30 days" value={formatMoney(orders?.revenue30)} loading={loading && !data} icon={Wallet} tone="emerald" delta={data && <Delta value={revenueDelta} />} hint={`${formatMoney(orders?.revenueDelivered)} delivered all-time`} />
        <Stat label="Approved pharmacies" value={formatNumber(data?.pharmacies?.approved)} loading={loading && !data} icon={Building2} tone="sky" hint={data ? `${data.pharmacies.pending} pending · ${data.pharmacies.suspended} suspended · ${data.pharmacies.rejected} rejected` : ""} />
        <Stat label="Customers" value={formatNumber(data?.customers?.total)} loading={loading && !data} icon={Users} tone="violet" hint={data ? `+${data.customers.new30} in 30 days · ${data.customers.suspended} suspended` : ""} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={trend === "orders" ? "Orders per day" : "Revenue per day"} description="Last 30 days, all statuses except cancelled counted toward revenue."
            actions={<Segmented size="sm" value={trend} onChange={setTrend} options={[{ value: "orders", label: "Orders" }, { value: "revenue", label: "Revenue" }]} />} />
          <div className="mt-4">
            {loading && !data ? <Skeleton className="h-60 w-full" /> : orders?.series?.some((d) => d[trend] > 0)
              ? <TrendChart data={orders.series} dataKey={trend} name={trend === "orders" ? "Orders" : "Revenue"} money={trend === "revenue"} />
              : <EmptyState icon={ShoppingBag} title="No orders in the last 30 days" description="The trend line appears once customers start placing orders." compact />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Needs attention" description="Queues waiting on an admin." />
          <div className="mt-4 space-y-2">
            {loading && !data ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />) : attention.map((item) => <AttentionItem key={item.to} {...item} />)}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Orders by status" description="All-time distribution." />
          <div className="mt-4">
            {loading && !data ? <Skeleton className="h-40 w-full" /> : <BarList items={statusItems} colorOf={(item) => item.color} emptyText="No orders yet" />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Orders by city" description="From the delivery address on each order." />
          <div className="mt-2">
            {loading && !data ? <Skeleton className="h-40 w-full" /> : orders?.cities?.length ? <CategoryBars data={orders.cities} categoryKey="city" valueKey="orders" name="Orders" /> : <EmptyState icon={ShoppingBag} title="No delivery data yet" compact />}
          </div>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title="Top pharmacies" description="By fulfilment revenue (non-cancelled)." actions={<Link to="/pharmacies" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>} />
          <div className="mt-4">
            {loading && !data ? <Skeleton className="h-40 w-full" /> : (
              <BarList emptyText="No fulfilments yet"
                items={(data?.topPharmacies || []).map((p) => ({ label: p.name, value: p.revenue, tag: <Badge tone="neutral" className="ml-1">{p.orders} orders</Badge> }))}
                valueFormatter={formatMoney} />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card padded={false} className="xl:col-span-2">
          <CardHeader className="px-5 pt-5" title="Recent orders" actions={<Link to="/orders" className="text-xs font-medium text-brand-600 hover:underline">All orders</Link>} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-wide text-subtle"><tr className="border-b border-line"><th className="px-5 py-2">Order</th><th className="px-3 py-2">Customer</th><th className="hidden px-3 py-2 md:table-cell">Pharmacies</th><th className="px-3 py-2">Status</th><th className="px-5 py-2 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-line">
                {loading && !data && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5} className="px-5 py-3"><Skeleton className="h-4 w-full" /></td></tr>)}
                {data && data.recentOrders.length === 0 && <tr><td colSpan={5}><EmptyState icon={ShoppingBag} title="No orders yet" compact /></td></tr>}
                {data?.recentOrders.map((o) => (
                  <tr key={o._id} className="hover:bg-surface-2">
                    <td className="px-5 py-2.5"><Link to={`/orders?id=${o._id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">{o.orderId}</Link><div className="text-[11px] text-subtle">{formatRelative(o.createdAt)}</div></td>
                    <td className="px-3 py-2.5 text-ink-2">{o.customer}</td>
                    <td className="hidden max-w-48 truncate px-3 py-2.5 text-muted md:table-cell">{o.pharmacies.join(", ") || "—"}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={o.status} /></td>
                    <td className="tabular px-5 py-2.5 text-right font-medium text-ink">{formatMoney(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent admin activity" actions={<Link to="/audit" className="text-xs font-medium text-brand-600 hover:underline">Audit log</Link>} />
          <ul className="mt-4 space-y-3">
            {loading && !data && Array.from({ length: 4 }).map((_, i) => <li key={i}><Skeleton className="h-9 w-full" /></li>)}
            {data && data.recentAudit.length === 0 && <li><EmptyState icon={ScrollText} title="No actions recorded yet" description="Approvals, suspensions and complaint updates will show here." compact /></li>}
            {data?.recentAudit.map((entry) => (
              <li key={entry._id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0"><p className="truncate text-ink-2">{entry.summary}</p><p className="text-[11px] text-subtle">{entry.actor?.name || "Admin"} · {formatRelative(entry.createdAt)}</p></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
