"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, MapPinned, Star, Truck, FileText, Package, ArrowRight, ShoppingCart, Store, Sparkles, ShieldCheck, Clock3, Bot, ChevronRight, MessageSquareWarning, BadgeCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatPKR } from "@/lib/currency";
import { useCart } from "@/context/CartContext";
import { recordSearchAndNavigate } from "@/lib/searchNavigation";
import VoiceMedicineSearchButton from "@/components/VoiceMedicineSearchButton";
import { Card, SectionHeader, Pill, StatusPill, Skeleton, EmptyState, initials, formatDate, cn } from "@/components/ui";

const QUICK_ACTIONS = [
  { href: "/pharmacies/map", icon: MapPinned, title: "Find care nearby", text: "Pharmacies, hospitals & clinics on a map", tone: "bg-teal-50 text-teal-700 group-hover:bg-teal-600" },
  { href: "/dashboard/prescriptions", icon: FileText, title: "Upload a prescription", text: "Keep prescriptions handy for your orders", tone: "bg-blue-50 text-blue-700 group-hover:bg-blue-600" },
  { href: "/assistant", icon: Bot, title: "Ask the AI assistant", text: "Dosage, side effects, how the platform works", tone: "bg-violet-50 text-violet-700 group-hover:bg-violet-600" },
  { href: "/dashboard/orders", icon: Truck, title: "Track an order", text: "Live status from each pharmacy", tone: "bg-amber-50 text-amber-700 group-hover:bg-amber-500" },
];

const POPULAR_SEARCHES = ["Panadol", "Augmentin", "Insulin", "ORS", "Cetirizine", "Vitamin D"];

function ProductCard({ product, onAdd }) {
  const available = product.stock > 0;
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-900/5">
      <Link href={`/product/${product.id}`} className="relative block bg-gradient-to-br from-blue-50 via-white to-teal-50 p-6" aria-label={`View ${product.name}`}>
        <div className="grid h-28 place-items-center text-6xl transition-transform duration-300 group-hover:scale-110">{product.image || "💊"}</div>
        <span className={cn("absolute left-4 top-4 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset", available ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-gray-100 text-gray-600 ring-gray-200")}>
          {available ? `In stock · ${product.stock}` : "Out of stock"}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{product.category || "Medicine"}</p>
        <Link href={`/product/${product.id}`} className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-gray-900 hover:text-blue-700">{product.name}</Link>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-600"><Store className="h-3.5 w-3.5 text-blue-600" /><span className="truncate">{product.pharmacyName}</span></p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <div><p className="text-lg font-bold text-gray-900">{formatPKR(product.price)}</p>{product.unit && <p className="text-[11px] text-gray-500">per {product.unit}</p>}</div>
          <button type="button" onClick={onAdd} disabled={!available}
            className={cn("inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition", available ? "bg-blue-700 text-white hover:bg-blue-800 active:scale-[0.98]" : "cursor-not-allowed bg-gray-100 text-gray-400")}>
            <ShoppingCart className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { addToCart } = useCart();
  const [heroQuery, setHeroQuery] = useState("");
  const [frequentByCount, setFrequentByCount] = useState([]);
  const [latestOrder, setLatestOrder] = useState(null);
  const [prescriptionAlert, setPrescriptionAlert] = useState(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [nearbyPharmacies, setNearbyPharmacies] = useState([]);
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(true);
  const [addedId, setAddedId] = useState(null);

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const key = "dc_session_id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const generated = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, generated);
    return generated;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadFrequent() {
      if (!sessionId) return;
      try {
        const res = await fetch("/api/recent-searches?sort=frequency&limit=6", { headers: { "x-session-id": sessionId } });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setFrequentByCount(data.recentSearches || []);
      } catch { /* non-blocking */ }
    }
    loadFrequent();
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) { setIsDataLoading(false); return; }
      try {
        const [ordersRes, prescriptionsRes] = await Promise.all([fetch("/api/orders"), fetch("/api/prescriptions")]);
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          if (ordersData.orders?.length) setLatestOrder(ordersData.orders[0]);
        }
        if (prescriptionsRes.ok) {
          const rxData = await prescriptionsRes.json();
          if (rxData.prescriptions?.length) setPrescriptionAlert(rxData.prescriptions.find((p) => p.status === "Pending") || rxData.prescriptions[0]);
        }
      } catch (error) {
        console.error("Failed to fetch user dashboard data", error);
      } finally {
        setIsDataLoading(false);
      }
    };
    fetchDashboardData();
  }, [user]);

  // Approved DawaConnect pharmacies and their live inventory.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/search?limit=6&sortBy=stock&inStockOnly=true").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/pharmacies?limit=4").then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([catalog, directory]) => {
        if (cancelled) return;
        setRecommendedProducts(catalog.items || []);
        setNearbyPharmacies(directory.pharmacies || []);
      })
      .catch(() => { if (!cancelled) { setRecommendedProducts([]); setNearbyPharmacies([]); } })
      .finally(() => { if (!cancelled) setIsLoadingPharmacies(false); });
    return () => { cancelled = true; };
  }, []);

  const persistSearchAndNavigate = async (raw) => { await recordSearchAndNavigate(router, raw); };
  const frequentTags = frequentByCount.map((item) => item.query).slice(0, 6);
  const tags = frequentTags.length ? frequentTags : POPULAR_SEARCHES;

  function handleAdd(product) {
    addToCart({
      cartItemId: `${product.pharmacyId}-${product.id}`, id: product.id, productId: product.id, name: product.name, price: product.price, quantity: 1,
      image: product.image, category: product.category, pharmacyId: product.pharmacyId, pharmacyName: product.pharmacyName, timing: product.timing,
      deliveryCharge: product.deliveryCharge, deliveryType: product.deliveryType, taxRate: product.taxRate,
    });
    setAddedId(product.id);
    setTimeout(() => setAddedId((current) => (current === product.id ? null : current)), 1600);
  }

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="bg-gray-50">
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-teal-800 text-white">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-1/3 h-[28rem] w-[28rem] rounded-full bg-teal-400/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] opacity-25 mix-blend-luminosity lg:block">
          <Image src="/med2.png" alt="" fill className="object-cover object-left" sizes="(max-width: 1024px) 0px, 42vw" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-blue-900/40 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100 ring-1 ring-white/15">
              <BadgeCheck className="h-3.5 w-3.5" /> Live stock from approved pharmacies only
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              {user ? <>Good to see you, {firstName}.<br /><span className="text-teal-200">What do you need today?</span></> : <>Medicines delivered<br /><span className="text-teal-200">from pharmacies you can trust.</span></>}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-blue-100/90 sm:text-lg">
              Search real inventory across DawaConnect pharmacies, compare prices, and place one order that reaches every seller.
            </p>

            <form className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={(e) => { e.preventDefault(); void persistSearchAndNavigate(heroQuery); }}>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input type="text" value={heroQuery} onChange={(e) => setHeroQuery(e.target.value)} placeholder="Search medicines, health products or pharmacies…" aria-label="Search medicines"
                  className="h-14 w-full rounded-2xl border-0 bg-white pl-12 pr-32 text-[15px] text-gray-900 shadow-xl shadow-blue-950/30 ring-1 ring-white/20 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-300" />
                <button type="submit" className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800">Search</button>
              </div>
              <div className="flex justify-center sm:justify-start"><VoiceMedicineSearchButton /></div>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-blue-200/80">{frequentTags.length ? "Frequently searched:" : "Popular:"}</span>
              {tags.map((tag, idx) => (
                <button key={`${tag}-${idx}`} type="button" onClick={() => void persistSearchAndNavigate(tag)} className="rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20">{tag}</button>
              ))}
            </div>
          </div>

          <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-3 sm:gap-4">
            {[[ShieldCheck, "Verified", "Every pharmacy is licence-checked and approved"], [Clock3, "Real-time", "Stock and prices come straight from the pharmacy"], [Truck, "One checkout", "Multiple pharmacies, a single order"]].map(([Icon, title, text]) => (
              <div key={title} className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10 backdrop-blur sm:p-4">
                <dt className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-teal-200" />{title}</dt>
                <dd className="mt-1 hidden text-xs leading-5 text-blue-100/80 sm:block">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ------------------------------ Quick actions ------------------------------ */}
        <section className="relative z-10 -mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Quick actions">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href} className="group flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl transition group-hover:text-white", action.tone)}><action.icon className="h-5 w-5" /></span>
              <span className="min-w-0"><span className="block text-sm font-semibold text-gray-900">{action.title}</span><span className="mt-0.5 hidden text-xs leading-5 text-gray-500 sm:block">{action.text}</span></span>
            </Link>
          ))}
        </section>

        {/* ------------------------------ Signed-in status ------------------------------ */}
        {(loading || isDataLoading) && (
          <Card className="mt-8"><div className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-72" /></div></div></Card>
        )}
        {!loading && !isDataLoading && user && (
          <Card className="mt-8" padded={false}>
            <div className="grid divide-y divide-gray-100 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              <div className="flex items-center gap-4 p-5">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-700 text-base font-bold text-white">{initials(user.name)}</span>
                <div className="min-w-0"><p className="text-xs text-gray-500">Signed in as</p><p className="truncate font-semibold text-gray-900">{user.name}</p><Link href="/dashboard" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">Open your portal <ChevronRight className="h-3 w-3" /></Link></div>
              </div>
              <div className="flex items-center gap-4 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><Package className="h-5 w-5" /></span>
                {latestOrder ? (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-gray-900">Order {latestOrder.orderId}</p><StatusPill status={latestOrder.status} /></div>
                    <p className="mt-0.5 text-xs text-gray-500">{latestOrder.estimatedDelivery ? `Est. delivery ${formatDate(latestOrder.estimatedDelivery)}` : `Placed ${formatDate(latestOrder.createdAt)}`} · <Link href={`/track/${latestOrder.orderId}`} className="font-semibold text-blue-700 hover:underline">Track</Link></p>
                  </div>
                ) : <div><p className="text-sm font-semibold text-gray-900">No active orders</p><p className="text-xs text-gray-500">Your latest order will show here.</p></div>}
              </div>
              <div className="flex items-center gap-4 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><FileText className="h-5 w-5" /></span>
                {prescriptionAlert ? (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-gray-900">{prescriptionAlert.title || "Prescription"}</p><Pill tone={prescriptionAlert.status === "Approved" ? "green" : prescriptionAlert.status === "Rejected" ? "red" : "amber"}>{prescriptionAlert.status}</Pill></div>
                    <p className="mt-0.5 text-xs text-gray-500">Uploaded {formatDate(prescriptionAlert.createdAt)} · <Link href="/dashboard/prescriptions" className="font-semibold text-blue-700 hover:underline">Manage</Link></p>
                  </div>
                ) : <div><p className="text-sm font-semibold text-gray-900">No prescriptions yet</p><p className="text-xs text-gray-500"><Link href="/dashboard/prescriptions" className="font-semibold text-blue-700 hover:underline">Upload one</Link> to reorder faster.</p></div>}
              </div>
            </div>
          </Card>
        )}

        {/* ------------------------------ Recommended ------------------------------ */}
        <section className="mt-12">
          <SectionHeader eyebrow="Live inventory" title="Recommended for you" description="Best-stocked products from approved pharmacies right now." href="/search" linkLabel="Browse everything" />
          {isLoadingPharmacies ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div>
          ) : recommendedProducts.length === 0 ? (
            <Card><EmptyState icon={Package} title="No inventory listed yet" description="Products appear here as soon as pharmacies are approved and add stock." action={<Link href="/pharmacies" className="text-sm font-semibold text-blue-700 hover:underline">See pharmacy directory</Link>} /></Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {recommendedProducts.map((product, idx) => <ProductCard key={`${product.id}-${idx}`} product={product} onAdd={() => handleAdd(product)} />)}
            </div>
          )}
        </section>

        {/* ------------------------------ Pharmacies + assistant ------------------------------ */}
        <section className="mt-12 grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" padded={false}>
            <div className="p-5 sm:p-6 sm:pb-2"><SectionHeader eyebrow="Directory" title="DawaConnect pharmacies" description="Approved, licence-checked pharmacies selling on the marketplace." href="/pharmacies" linkLabel="All pharmacies" className="mb-0" /></div>
            <ul className="divide-y divide-gray-100">
              {isLoadingPharmacies && Array.from({ length: 3 }).map((_, i) => <li key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6"><Skeleton className="h-11 w-11 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div></li>)}
              {!isLoadingPharmacies && nearbyPharmacies.length === 0 && <li><EmptyState icon={Store} title="No approved pharmacies yet" description="Pharmacies appear here after DawaConnect approves their registration." compact /></li>}
              {nearbyPharmacies.map((pharmacy) => (
                <li key={pharmacy.id}>
                  <Link href={`/pharmacies/${pharmacy.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-gray-50 sm:px-6">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Store className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2"><span className="truncate font-semibold text-gray-900">{pharmacy.name}</span><Pill tone={pharmacy.isOpen ? "green" : "gray"} dot>{pharmacy.isOpen ? "Open" : pharmacy.status || "Closed"}</Pill></span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500">{[pharmacy.area, pharmacy.city].filter(Boolean).join(", ") || pharmacy.address} · {pharmacy.timing}{pharmacy.productCount ? ` · ${pharmacy.productCount} products` : ""}</span>
                    </span>
                    <span className="hidden items-center gap-1 text-sm font-semibold text-gray-700 sm:inline-flex">{pharmacy.rating != null ? <><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{pharmacy.rating}</> : <span className="text-xs font-medium text-gray-400">New</span>}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 border-t border-gray-100 p-4 sm:px-6">
              <Link href="/pharmacies" className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Pharmacy directory</Link>
              <Link href="/pharmacies/map" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"><MapPinned className="h-4 w-4" /> Explore nearby care</Link>
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-blue-800 to-blue-900 p-6 text-white shadow-lg shadow-blue-900/20">
              <Sparkles className="absolute -right-4 -top-4 h-28 w-28 text-white/10" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold"><Bot className="h-3.5 w-3.5" /> AI Health Assistant</span>
              <h3 className="mt-4 text-xl font-bold leading-tight">Questions about a medicine?</h3>
              <p className="mt-2 text-sm leading-6 text-blue-100">Ask about dosage, side effects or interactions in plain language. Educational guidance, 20 questions a day.</p>
              <Link href="/assistant" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-50">Open the assistant <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <Card>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><MessageSquareWarning className="h-4 w-4 text-blue-700" /> Something went wrong with an order?</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">Raise it with the pharmacy or with DawaConnect support and follow the reply from your portal.</p>
              <Link href={user ? "/dashboard/complaints" : "/login?next=/dashboard/complaints"} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">Support &amp; complaints <ChevronRight className="h-4 w-4" /></Link>
            </Card>
          </div>
        </section>

        <div className="h-16" />
      </div>

      {addedId && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-xl">
            <ShoppingCart className="h-4 w-4 text-teal-300" /> Added to cart
            <Link href="/cart" className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25">View cart</Link>
          </div>
        </div>
      )}
    </div>
  );
}
