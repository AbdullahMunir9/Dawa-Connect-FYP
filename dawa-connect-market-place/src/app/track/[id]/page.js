"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Check, Clock, Home, Package, Store, Truck } from "lucide-react";
import { formatPKR } from "@/lib/currency";
import { useAuth } from "@/context/AuthContext";

const STEPS = ["Processing", "Confirmed", "Packed", "Dispatched", "Delivered"];
const STEP_ICONS = [Clock, Check, Package, Truck, Home];

export default function TrackDelivery() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadOrder() {
      try {
        const response = await fetch(`/api/orders?orderId=${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load order");
        if (active) {
          setOrder(data.order);
          setError("");
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOrder();
    const interval = setInterval(loadOrder, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id]);

  if (loading) return <div className="max-w-5xl mx-auto py-16 px-4 text-center text-gray-500">Loading order…</div>;
  if (error || !order) return <div className="max-w-5xl mx-auto py-16 px-4 text-center text-red-600">{error || "Order not found"}</div>;

  const currentIndex = order.status === "Partially Delivered"
    ? STEPS.indexOf("Dispatched")
    : STEPS.indexOf(order.status);
  const address = order.deliveryAddress || {};

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
          <div>
            <p className="text-sm uppercase tracking-wide text-blue-700 font-semibold">Live order status</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Order #{order.orderId}</h1>
            <p className="text-sm text-gray-500 mt-1">Placed {new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <span className={`self-start px-3 py-1.5 rounded-full text-sm font-semibold ${order.status === "Cancelled" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-800"}`}>
            {order.status}
          </span>
        </div>

        {order.status !== "Cancelled" && (
          <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6 overflow-x-auto">
            <div className="flex min-w-[640px]">
              {STEPS.map((step, index) => {
                const Icon = STEP_ICONS[index];
                const reached = index <= currentIndex;
                return (
                  <div key={step} className="flex-1 flex items-center last:flex-none">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${reached ? "bg-teal-700 text-white" : "bg-gray-100 text-gray-400"}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs font-medium ${reached ? "text-teal-800" : "text-gray-400"}`}>{step}</span>
                    </div>
                    {index < STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-3 mb-6 ${index < currentIndex ? "bg-teal-700" : "bg-gray-200"}`} />}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-5">
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900">Pharmacy fulfillment</h2>
              <div className="divide-y divide-gray-100 mt-3">
                {(order.fulfillments || []).map((fulfillment) => (
                  <div key={fulfillment.pharmacyOrderId} className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Store className="w-5 h-5 text-blue-700 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">{fulfillment.pharmacyName}</p>
                        <p className="text-xs text-gray-500 mt-1">{fulfillment.itemCount} item(s) · #{fulfillment.pharmacyOrderId}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-blue-800">{fulfillment.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Items</h2>
              <div className="space-y-3">
                {(order.items || []).map((item) => (
                  <div key={`${item.pharmacyId}-${item.productId}`} className="flex justify-between gap-4 text-sm">
                    <span className="text-gray-700">{item.name} × {item.quantity}</span>
                    <span className="font-medium">{formatPKR(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Order total</h2>
              <div className="space-y-2 text-sm text-gray-600">
                <p className="flex justify-between"><span>Subtotal</span><span>{formatPKR(order.subtotal)}</span></p>
                <p className="flex justify-between"><span>Tax</span><span>{formatPKR(order.tax)}</span></p>
                <p className="flex justify-between"><span>Delivery</span><span>{formatPKR(order.deliveryFee)}</span></p>
                <p className="flex justify-between"><span>Processing</span><span>{formatPKR(order.processingFee)}</span></p>
              </div>
              <p className="flex justify-between border-t border-gray-100 mt-4 pt-4 font-bold text-gray-900"><span>Total</span><span>{formatPKR(order.total)}</span></p>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Delivery address</h2>
              <p className="text-sm text-gray-600 leading-6">
                {[address.line1, address.line2, address.city, address.province, address.postalCode].filter(Boolean).join(", ")}
              </p>
              {address.phone && <p className="text-sm text-gray-500 mt-2">{address.phone}</p>}
            </section>

            <Link href={user ? "/dashboard/orders" : "/"} className="block text-center py-2.5 border border-blue-200 text-blue-700 rounded-lg font-medium hover:bg-blue-50">
              {user ? "View all orders" : "Continue shopping"}
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
