"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Truck, FileText, Bookmark, MessageSquareWarning, PackageCheck, ShoppingBag, ArrowRight, MapPin, Plus, Bot, Search, UploadCloud, ChevronRight, Clock3 } from "lucide-react";
import { formatPKR } from "@/lib/currency";
import { Card, SectionHeader, Pill, StatusPill, Skeleton, EmptyState, formatDate, relativeTime, cn } from "@/components/ui";

const ACTIVE = ["Processing", "Confirmed", "Packed", "Dispatched"];

function Stat({ label, value, icon: Icon, tone, href, hint, loading }) {
  return (
    <Link href={href} className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl transition group-hover:text-white", tone)}><Icon className="h-5 w-5" /></span>
        <ArrowRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500" />
      </div>
      {loading ? <Skeleton className="mt-4 h-7 w-16" /> : <p className="mt-4 text-2xl font-bold tabular-nums tracking-tight text-gray-900">{value}</p>}
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </Link>
  );
}

export default function DashboardOverview() {
  const { user } = useAuth();
  const [data, setData] = useState({ orders: [], prescriptions: [], saved: [], complaints: [] });
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const safe = (url, key) => fetch(url).then((r) => (r.ok ? r.json() : {})).then((d) => d[key] || []).catch(() => []);
    Promise.all([safe("/api/orders", "orders"), safe("/api/prescriptions", "prescriptions"), safe("/api/saved", "savedItems"), safe("/api/complaints", "complaints")])
      .then(([orders, prescriptions, saved, complaints]) => { if (!cancelled) setData({ orders, prescriptions, saved, complaints }); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;

  const { orders, prescriptions, saved, complaints } = data;
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const delivered = orders.filter((o) => o.status === "Delivered");
  const spent = delivered.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const openComplaints = complaints.filter((c) => ["open", "in_review"].includes(c.status));
  const latestRx = prescriptions[0];
  const defaultAddress = (user.addresses || []).find((a) => a.isDefault) || (user.addresses || [])[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{greeting}, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-gray-500">{active.length ? `${active.length} order${active.length > 1 ? "s" : ""} on the way.` : "Everything is up to date."} Here's your account at a glance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/search" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"><Search className="h-4 w-4" /> Find medicines</Link>
          <Link href="/dashboard/prescriptions" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"><UploadCloud className="h-4 w-4" /> Upload prescription</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Active orders" value={active.length} icon={Truck} tone="bg-blue-50 text-blue-700 group-hover:bg-blue-700" href="/dashboard/orders" hint={`${orders.length} total · ${delivered.length} delivered`} loading={fetching} />
        <Stat label="Delivered spend" value={formatPKR(spent)} icon={PackageCheck} tone="bg-teal-50 text-teal-700 group-hover:bg-teal-700" href="/dashboard/orders" hint="Across delivered orders" loading={fetching} />
        <Stat label="Prescriptions" value={prescriptions.length} icon={FileText} tone="bg-violet-50 text-violet-700 group-hover:bg-violet-700" href="/dashboard/prescriptions" hint={prescriptions.filter((p) => p.status === "Pending").length ? `${prescriptions.filter((p) => p.status === "Pending").length} pending review` : "All reviewed"} loading={fetching} />
        <Stat label="Open complaints" value={openComplaints.length} icon={MessageSquareWarning} tone="bg-amber-50 text-amber-700 group-hover:bg-amber-500" href="/dashboard/complaints" hint={`${saved.length} saved item${saved.length === 1 ? "" : "s"}`} loading={fetching} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" padded={false}>
          <div className="p-5 pb-3 sm:p-6 sm:pb-3"><SectionHeader title="Recent orders" description="Status updates come straight from each pharmacy." href="/dashboard/orders" linkLabel="All orders" className="mb-0" /></div>
          {fetching ? <div className="space-y-3 px-5 pb-5 sm:px-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            : orders.length === 0 ? <EmptyState icon={ShoppingBag} title="No orders yet" description="Search live pharmacy stock and place your first order." action={<Link href="/search" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Browse medicines</Link>} />
            : (
              <ul className="divide-y divide-gray-100">
                {orders.slice(0, 4).map((order) => (
                  <li key={order._id}>
                    <Link href={`/track/${order.orderId}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-gray-50 sm:px-6">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-500"><ShoppingBag className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-gray-900">#{order.orderId}</span><StatusPill status={order.status} /></span>
                        <span className="mt-0.5 block truncate text-xs text-gray-500">{(order.items || []).slice(0, 3).map((i) => i.name).join(", ")}{order.items?.length > 3 ? ` +${order.items.length - 3} more` : ""} · {(order.fulfillments || []).map((f) => f.pharmacyName).join(", ")}</span>
                      </span>
                      <span className="text-right"><span className="block text-sm font-bold tabular-nums text-gray-900">{formatPKR(order.total)}</span><span className="block text-[11px] text-gray-500">{relativeTime(order.createdAt)}</span></span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><FileText className="h-4 w-4 text-violet-600" /> Latest prescription</h2>
              <Link href="/dashboard/prescriptions" className="text-xs font-semibold text-blue-700 hover:underline">Manage</Link>
            </div>
            {fetching ? <Skeleton className="mt-4 h-14" /> : latestRx ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-violet-600 shadow-sm"><FileText className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{latestRx.title}</p><p className="text-xs text-gray-500">Uploaded {formatDate(latestRx.createdAt)}</p></div>
                <Pill tone={latestRx.status === "Approved" ? "green" : latestRx.status === "Rejected" ? "red" : "amber"}>{latestRx.status}</Pill>
              </div>
            ) : <p className="mt-3 text-sm text-gray-500">No prescriptions uploaded. Keep one on file to speed up prescription-only orders.</p>}
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><MapPin className="h-4 w-4 text-teal-600" /> Default delivery address</h2>
              <Link href="/dashboard/addresses" className="text-xs font-semibold text-blue-700 hover:underline">{defaultAddress ? "Change" : "Add"}</Link>
            </div>
            {defaultAddress ? (
              <div className="mt-3 text-sm"><p className="font-semibold text-gray-900">{defaultAddress.fullName} <span className="ml-1 text-xs font-normal text-gray-500">({defaultAddress.label})</span></p><p className="text-gray-600">{[defaultAddress.line1, defaultAddress.line2].filter(Boolean).join(", ")}</p><p className="text-gray-500">{[defaultAddress.city, defaultAddress.province, defaultAddress.postalCode].filter(Boolean).join(", ")}</p></div>
            ) : (
              <Link href="/dashboard/addresses" className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-4 text-sm font-medium text-gray-600 hover:border-blue-300 hover:text-blue-700"><Plus className="h-4 w-4" /> Add an address for faster checkout</Link>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padded={false}>
          <div className="p-5 pb-3 sm:p-6 sm:pb-3"><SectionHeader title="Saved items" href="/dashboard/saved" className="mb-0" /></div>
          {fetching ? <div className="grid grid-cols-3 gap-3 px-5 pb-5 sm:px-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
            : saved.length === 0 ? <EmptyState icon={Bookmark} title="Nothing saved yet" description="Bookmark products to find them again quickly." compact />
            : (
              <ul className="grid grid-cols-3 gap-3 px-5 pb-5 sm:px-6">
                {saved.slice(0, 3).map((item) => (
                  <li key={item._id}><Link href={`/product/${item.productId}`} className="block rounded-xl border border-gray-200 p-3 text-center transition hover:border-blue-300 hover:shadow-sm"><span className="block text-3xl">{item.image || "💊"}</span><span className="mt-2 line-clamp-2 block text-xs font-semibold text-gray-900">{item.name}</span><span className="block text-xs text-blue-700">{formatPKR(item.price)}</span></Link></li>
                ))}
              </ul>
            )}
        </Card>

        <Card padded={false}>
          <div className="p-5 pb-3 sm:p-6 sm:pb-3"><SectionHeader title="Support & complaints" href="/dashboard/complaints" linkLabel="Open" className="mb-0" /></div>
          {fetching ? <div className="space-y-2 px-5 pb-5 sm:px-6"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            : complaints.length === 0 ? <EmptyState icon={MessageSquareWarning} title="No complaints" description="Problem with an order? Raise it with the pharmacy or DawaConnect support." compact action={<Link href="/dashboard/complaints?new=1" className="text-sm font-semibold text-blue-700 hover:underline">Report a problem</Link>} />
            : (
              <ul className="divide-y divide-gray-100">
                {complaints.slice(0, 3).map((c) => (
                  <li key={c._id}><Link href="/dashboard/complaints" className="flex items-center gap-3 px-5 py-3 transition hover:bg-gray-50 sm:px-6"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-gray-900">{c.subject}</span><span className="block text-xs text-gray-500">{c.target === "pharmacy" ? c.pharmacyName : "DawaConnect support"} · <Clock3 className="inline h-3 w-3" /> {relativeTime(c.lastActivityAt)}</span></span><Pill tone={c.status === "resolved" ? "green" : c.status === "dismissed" ? "gray" : c.status === "in_review" ? "blue" : "amber"}>{c.status.replace("_", " ")}</Pill></Link></li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-700 via-blue-800 to-blue-900 p-6 text-white">
        <Bot className="absolute -right-6 -top-6 h-32 w-32 text-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-blue-200">AI Health Assistant</p><p className="mt-1 text-lg font-bold">Not sure how to take a medicine?</p><p className="text-sm text-blue-100">Ask about dosage, side effects and interactions — 20 questions a day, free.</p></div>
          <Link href="/assistant" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">Ask now <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </div>
  );
}
