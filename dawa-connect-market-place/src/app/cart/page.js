"use client";

import Link from "next/link";
import { Lock, FileText, ShoppingBag, ShieldCheck, Truck, CheckCircle2, ChevronRight, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useCart } from "@/context/CartContext";
import { formatPKR } from "@/lib/currency";

export default function Cart() {
  const { items, updateQuantity, removeFromCart, totalItems } = useCart();

  const groupedByPharmacy = useMemo(() => {
    const grouped = new Map();
    for (const item of items) {
      if (!grouped.has(item.pharmacyId)) {
        grouped.set(item.pharmacyId, {
          pharmacyId: item.pharmacyId,
          pharmacyName: item.pharmacyName || "Unknown Pharmacy",
          timing: item.timing || "Delivery timing not available",
          items: [],
        });
      }
      grouped.get(item.pharmacyId).items.push(item);
    }
    return Array.from(grouped.values());
  }, [items]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );
  const tax = subtotal * 0.05;
  const delivery = subtotal > 0 ? 0 : 0;
  const total = subtotal + tax + delivery;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Cart</h1>
        <p className="text-gray-600">Review your medical supplies and prescriptions before checkout.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Column - Cart Items */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          {groupedByPharmacy.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
              <p className="text-gray-600 mb-5">Browse medicines and add items to continue.</p>
              <Link href="/search" className="inline-flex bg-blue-800 text-white px-5 py-2.5 rounded-lg hover:bg-blue-900">
                Go to Search
              </Link>
            </div>
          ) : (
            groupedByPharmacy.map((group) => (
              <div key={group.pharmacyId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-blue-700">
                      <span className="font-bold">{(group.pharmacyName || "P")[0]}</span>
                    </div>
                    <h2 className="font-semibold text-gray-900 text-lg">{group.pharmacyName}</h2>
                    <span className="bg-teal-50 text-teal-700 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verified Partner
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-1.5">
                    <Truck className="w-4 h-4" /> {group.timing}
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {group.items.map((item, index) => (
                    <div key={item.cartItemId}>
                      <div className="flex flex-col sm:flex-row gap-6">
                        <div className="w-24 h-24 bg-blue-50 border border-gray-100 rounded-lg flex items-center justify-center shrink-0 p-2 text-4xl">
                          {item.image || "💊"}
                        </div>

                        <div className="flex-grow flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="font-semibold text-gray-900 text-lg">{item.name}</h3>
                              <p className="text-lg font-bold text-gray-900">{formatPKR(item.price)}</p>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
                              {item.category?.toLowerCase()?.includes("antibiotic") ? (
                                <>
                                  <FileText className="w-4 h-4 text-gray-400" /> Prescription Required
                                </>
                              ) : (
                                <>
                                  <ShoppingBag className="w-4 h-4 text-gray-400" /> {item.category || "General"}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden w-28">
                              <button onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)} className="px-3 py-1.5 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors w-full">
                                -
                              </button>
                              <span className="px-2 py-1.5 font-medium text-gray-900 w-full text-center text-sm">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} className="px-3 py-1.5 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors w-full">
                                +
                              </button>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-sm text-gray-500">Subtotal: {formatPKR(item.quantity * item.price)}</p>
                              <button onClick={() => removeFromCart(item.cartItemId)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      {index < group.items.length - 1 && <hr className="border-gray-100 mt-6" />}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column - Order Summary & Features */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          
          {/* Order Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Summary</h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center text-gray-600">
                <span>Subtotal ({totalItems} items)</span>
                <span>{formatPKR(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Estimated Tax</span>
                <span>{formatPKR(tax)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Delivery Fee</span>
                <span className="text-teal-600 font-medium">{delivery === 0 ? "FREE" : formatPKR(delivery)}</span>
              </div>
            </div>

            <hr className="border-gray-200 mb-6" />

            <div className="flex justify-between items-center mb-6">
              <span className="text-xl font-bold text-gray-900">Total</span>
              <span className="text-3xl font-bold text-blue-800">{formatPKR(total)}</span>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Promo Code</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Enter code" 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                  Apply
                </button>
              </div>
            </div>

            <Link href="/checkout" className="w-full bg-blue-800 text-white font-medium py-3 rounded-lg hover:bg-blue-900 transition-colors flex items-center justify-center gap-2 mb-4">
              Proceed to Checkout <ChevronRight className="w-5 h-5" />
            </Link>

            <div className="flex flex-col items-center justify-center gap-3">
              <span className="flex items-center gap-1.5 text-sm text-teal-700 font-medium">
                <Lock className="w-4 h-4" /> Secure Clinical Checkout
              </span>
              <div className="flex gap-2 opacity-50 grayscale">
                {/* Mock payment icons */}
                <div className="w-8 h-5 bg-gray-300 rounded border border-gray-400"></div>
                <div className="w-8 h-5 bg-gray-300 rounded border border-gray-400"></div>
                <div className="w-8 h-5 bg-gray-300 rounded border border-gray-400"></div>
              </div>
            </div>
          </div>

          {/* Features Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-6">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Pharmacist Review</h3>
                <p className="text-sm text-gray-600">All prescriptions are verified by licensed pharmacists before shipment.</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Temperature Controlled</h3>
                <p className="text-sm text-gray-600">Sensitive medications are shipped in climate-monitored packaging.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
