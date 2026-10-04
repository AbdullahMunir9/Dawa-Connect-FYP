"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Lock,
  PackageOpen,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPKR } from "@/lib/currency";

function ProductPreview({ item, compact = false }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "sm:gap-5"}`}>
      <div className={`${compact ? "h-14 w-14 text-2xl" : "h-20 w-20 text-3xl"} flex shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 p-2`}>
        {item.image || "💊"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-gray-900">{item.name}</p>
        <p className="mt-1 text-xs text-gray-500">{item.category || "General"} · Qty {item.quantity}</p>
      </div>
      <p className="shrink-0 text-sm font-bold text-gray-900">{formatPKR(item.price * item.quantity)}</p>
    </div>
  );
}

function AllCarts({ carts }) {
  if (carts.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
        <PackageOpen className="mx-auto h-12 w-12 text-blue-200" />
        <h2 className="mt-5 text-xl font-bold text-gray-900">Your carts are empty</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">Medicines from each pharmacy will appear in their own cart, with a separate checkout and order.</p>
        <Link href="/search" className="mt-6 inline-flex rounded-xl bg-blue-800 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-900">Browse medicines</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {carts.map((cart) => (
        <article key={cart.pharmacyId} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
          <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-800 text-lg font-bold text-white">{(cart.pharmacyName || "P").charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold text-gray-950">{cart.pharmacyName}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-teal-600" /> Verified pharmacy</span>
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {cart.timing}</span>
                </div>
              </div>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">{cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}</span>
            </div>
          </div>

          <div className="space-y-4 p-6">
            {cart.items.slice(0, 2).map((item) => <ProductPreview key={item.cartItemId} item={item} compact />)}
            {cart.items.length > 2 && <p className="text-center text-xs font-medium text-gray-500">+ {cart.items.length - 2} more product{cart.items.length - 2 === 1 ? "" : "s"}</p>}
            <div className="flex items-end justify-between border-t border-gray-100 pt-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Separate order total</p>
                <p className="mt-1 text-2xl font-black text-blue-900">{formatPKR(cart.total)}</p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>{cart.deliveryFee ? `${formatPKR(cart.deliveryFee)} delivery` : "Free delivery"}</p>
                <p className="mt-1">Tax and processing included</p>
              </div>
            </div>
            <Link href={`/cart?pharmacyId=${encodeURIComponent(cart.pharmacyId)}`} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-900 px-4 py-3 text-sm font-bold text-blue-900 transition hover:bg-blue-900 hover:text-white">
              View this cart <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function PharmacyCart({ cart, updateQuantity, removeFromCart }) {
  return (
    <>
      <Link href="/cart" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-950"><ArrowLeft className="h-4 w-4" /> All pharmacy carts</Link>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <header className="border-b border-gray-100 bg-gradient-to-r from-blue-50 via-white to-teal-50 px-6 py-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-800 text-white"><Store className="h-6 w-6" /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Pharmacy cart</p>
                <h1 className="mt-1 text-2xl font-black text-gray-950">{cart.pharmacyName}</h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500"><Truck className="h-4 w-4" /> {cart.timing}</p>
              </div>
            </div>
          </header>
          <div className="divide-y divide-gray-100 px-6">
            {cart.items.map((item) => (
              <div key={item.cartItemId} className="py-6">
                <ProductPreview item={item} />
                <div className="mt-4 flex items-center justify-between pl-0 sm:pl-[100px]">
                  <div className="flex items-center overflow-hidden rounded-xl border border-gray-300 bg-white">
                    <button type="button" aria-label={`Decrease ${item.name}`} onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)} className="px-3 py-2 text-gray-600 hover:bg-gray-100">−</button>
                    <span className="min-w-10 px-2 text-center text-sm font-bold">{item.quantity}</span>
                    <button type="button" aria-label={`Increase ${item.name}`} onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} className="px-3 py-2 text-gray-600 hover:bg-gray-100">+</button>
                  </div>
                  <button type="button" onClick={() => removeFromCart(item.cartItemId)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /> Remove</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-gray-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
          <h2 className="text-xl font-bold text-gray-950">This order</h2>
          <p className="mt-1 text-sm text-gray-500">Only products from {cart.pharmacyName} are included.</p>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between text-gray-600"><dt>Subtotal ({cart.itemCount} items)</dt><dd>{formatPKR(cart.subtotal)}</dd></div>
            <div className="flex justify-between text-gray-600"><dt>Pharmacy tax</dt><dd>{formatPKR(cart.tax)}</dd></div>
            <div className="flex justify-between text-gray-600"><dt>Delivery</dt><dd>{cart.deliveryFee ? formatPKR(cart.deliveryFee) : <span className="font-semibold text-teal-700">Free</span>}</dd></div>
            <div className="flex justify-between text-gray-600"><dt>Processing</dt><dd>{formatPKR(cart.processingFee)}</dd></div>
          </dl>
          <div className="mt-5 flex items-end justify-between border-t border-gray-200 pt-5"><span className="font-bold text-gray-900">Total</span><span className="text-3xl font-black text-blue-900">{formatPKR(cart.total)}</span></div>
          <Link href={`/checkout?pharmacyId=${encodeURIComponent(cart.pharmacyId)}`} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 py-3.5 text-sm font-bold text-white hover:bg-blue-900">Checkout this cart <ChevronRight className="h-4 w-4" /></Link>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-teal-700"><Lock className="h-3.5 w-3.5" /> Secure, separate pharmacy checkout</p>
        </aside>
      </div>
    </>
  );
}

function CartContent() {
  const searchParams = useSearchParams();
  const selectedPharmacyId = searchParams.get("pharmacyId") || "";
  const { pharmacyCarts, updateQuantity, removeFromCart } = useCart();
  const selectedCart = pharmacyCarts.find((cart) => cart.pharmacyId === selectedPharmacyId) || null;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      {!selectedCart && (
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">Independent pharmacy orders</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950">All carts</h1>
            <p className="mt-2 max-w-2xl text-gray-600">Every pharmacy has its own cart, delivery fee, checkout and order tracking.</p>
          </div>
          {pharmacyCarts.length > 0 && <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-900"><ShoppingBag className="h-4 w-4" /> {pharmacyCarts.length} {pharmacyCarts.length === 1 ? "cart" : "carts"}</span>}
        </header>
      )}
      {selectedCart ? <PharmacyCart cart={selectedCart} updateQuantity={updateQuantity} removeFromCart={removeFromCart} /> : <AllCarts carts={pharmacyCarts} />}
    </main>
  );
}

export default function CartPage() {
  return <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 text-center text-gray-500">Loading your carts…</div>}><CartContent /></Suspense>;
}
