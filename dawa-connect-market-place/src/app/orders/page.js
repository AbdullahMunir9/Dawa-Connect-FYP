"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3, MessageCircle, Package, Store, Truck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatPKR } from "@/lib/currency";

function orderDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadOrders() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/orders", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to load your orders.");
        if (active) setOrders(data.orders || []);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (!authLoading) loadOrders();
    return () => { active = false; };
  }, [authLoading, user]);

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Order tracking</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-950">Your DawaConnect orders</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              {user
                ? "This includes orders from your account and any guest orders placed earlier in this browser."
                : "Guest orders stay available in this browser for 30 days, unless browser cookies are cleared or private browsing is used."}
            </p>
          </div>
          <Link href="/search" className="inline-flex items-center justify-center rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900">
            Continue shopping
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-500">Loading your orders…</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
            <Package className="mx-auto h-11 w-11 text-blue-200" />
            <h2 className="mt-4 text-lg font-bold text-gray-900">No orders found in this browser</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
              Guest access is tied to the browser used at checkout. Sign in to access account orders across your devices.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <article key={order.orderId} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-gray-950">Order #{order.orderId}</h2>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{order.status}</span>
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-sm text-gray-600"><Store className="h-4 w-4 text-blue-600" /> {order.pharmacyName || order.fulfillments?.[0]?.pharmacyName || "DawaConnect pharmacy"}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-gray-500"><Clock3 className="h-3.5 w-3.5" /> Placed {orderDate(order.createdAt)}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total</p>
                    <p className="mt-1 text-lg font-bold text-gray-950">{formatPKR(order.total)}</p>
                  </div>
                </div>
                <div className="grid gap-2 border-t border-gray-100 bg-gray-50/70 p-4 sm:grid-cols-2">
                  <Link href={`/track/${encodeURIComponent(order.orderId)}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900">
                    <Truck className="h-4 w-4" /> Track order
                  </Link>
                  <Link href={`/chat/order/${encodeURIComponent(order.orderId)}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">
                    <MessageCircle className="h-4 w-4" /> Open pharmacy chat
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
