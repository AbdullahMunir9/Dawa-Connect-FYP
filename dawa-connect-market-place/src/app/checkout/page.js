"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard, Banknote, MapPin, Info, ChevronRight, Loader2, LocateFixed } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatPKR } from "@/lib/currency";
import { reverseGeocode } from "@/lib/osm";

const emptyManualAddress = {
  label: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  province: "",
  postalCode: "",
};

const addressInputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, checkUserLoggedIn } = useAuth();
  const { pharmacyCarts, isReady: cartReady, clearPharmacyCart } = useCart();
  const requestedPharmacyId = searchParams.get("pharmacyId") || "";
  const selectedCart = pharmacyCarts.find((cart) => cart.pharmacyId === requestedPharmacyId)
    || (!requestedPharmacyId && pharmacyCarts.length === 1 ? pharmacyCarts[0] : null);
  const checkoutItems = selectedCart?.items || [];
  const checkoutItemCount = selectedCart?.itemCount || 0;
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressMode, setAddressMode] = useState("manual");
  const [manualAddress, setManualAddress] = useState(emptyManualAddress);
  const [saveAddress, setSaveAddress] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    const fetchAddresses = async () => {
      const response = await fetch("/api/user/addresses");
      if (!response.ok) return;
      const data = await response.json();
      const nextAddresses = data.addresses || [];
      setAddresses(nextAddresses);
      const defaultAddress = nextAddresses.find((address) => address.isDefault) || nextAddresses[0];
      if (defaultAddress) {
        setSelectedAddressId(String(defaultAddress._id));
        setAddressMode("saved");
      } else {
        setAddressMode("manual");
      }
    };

    if (user) {
      fetchAddresses();
    } else if (!authLoading) {
      setAddresses([]);
      setSelectedAddressId("");
      setAddressMode("manual");
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!user) return;
    setManualAddress((current) => ({
      ...current,
      fullName: current.fullName || user.name || "",
      phone: current.phone || user.phone || "",
      city: current.city || user.city || "",
    }));
  }, [user]);

  const subtotal = selectedCart?.subtotal || 0;
  const tax = selectedCart?.tax || 0;
  const processingFee = selectedCart?.processingFee || 0;
  const deliveryFee = selectedCart?.deliveryFee || 0;
  const total = subtotal + tax + processingFee + deliveryFee;
  const selectedAddress = addresses.find((address) => String(address._id) === String(selectedAddressId));
  const usingSavedAddress = Boolean(user && addressMode === "saved");
  const manualAddressValid = ["fullName", "phone", "line1", "city"].every(
    (field) => manualAddress[field].trim()
  );
  const checkoutAddress = usingSavedAddress ? selectedAddress : manualAddress;

  const updateManualAddress = (field, value) => {
    setManualAddress((current) => ({ ...current, [field]: value }));
  };

  const useCurrentLocation = async () => {
    setLocationError("");
    if (!("geolocation" in navigator)) {
      setLocationError("Your browser does not support location access.");
      return;
    }

    setLocating(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 5 * 60 * 1000,
        });
      });
      const detectedAddress = await reverseGeocode(
        position.coords.latitude,
        position.coords.longitude
      );
      setManualAddress((current) => ({
        ...current,
        line1: detectedAddress.line1 || current.line1,
        city: detectedAddress.city || current.city,
        province: detectedAddress.province || current.province,
        postalCode: detectedAddress.postalCode || current.postalCode,
      }));
    } catch (error) {
      if (error?.code === 1) {
        setLocationError("Location permission was denied. You can still enter the address manually.");
      } else if (error?.code === 2) {
        setLocationError("Your current location could not be determined.");
      } else if (error?.code === 3) {
        setLocationError("Location detection timed out. Please try again.");
      } else {
        setLocationError(error?.message || "The address could not be detected.");
      }
    } finally {
      setLocating(false);
    }
  };

  const handlePlaceOrder = async () => {
    setCheckoutError("");
    if (!selectedCart || !checkoutAddress || (!usingSavedAddress && !manualAddressValid) || checkoutItems.length === 0) {
      setCheckoutError("Please complete the required delivery address fields.");
      return;
    }
    setPlacingOrder(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: checkoutItems.map((item) => ({
            productId: item.productId || item.id,
            pharmacyId: item.pharmacyId,
            quantity: item.quantity,
          })),
          addressId: usingSavedAddress ? selectedAddressId : undefined,
          deliveryAddress: !usingSavedAddress ? manualAddress : undefined,
          saveAddress: Boolean(user && !usingSavedAddress && saveAddress),
          paymentMethod,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        clearPharmacyCart(selectedCart.pharmacyId);
        if (user && !usingSavedAddress && saveAddress) {
          await checkUserLoggedIn();
        }
        router.push(`/track/${data.order.orderId}`);
      } else {
        const data = await response.json().catch(() => ({}));
        setCheckoutError(data.message || "The order could not be placed. Please review your cart and try again.");
      }
    } catch {
      setCheckoutError("The order service is temporarily unavailable. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  if (!cartReady) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center text-gray-500">Loading your pharmacy cart…</div>;
  }

  if (!selectedCart) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="rounded-3xl border border-gray-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-950">Choose a pharmacy cart</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">Each pharmacy is checked out as a separate order. Return to your carts and select the pharmacy you want to order from.</p>
          <Link href="/cart" className="mt-6 inline-flex rounded-xl bg-blue-800 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-900">View all carts</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Breadcrumbs */}
      <div className="flex items-center text-xs font-bold text-gray-500 uppercase tracking-wider mb-8">
        <span className="text-blue-800">CHECKOUT</span>
        <span className="mx-3">&rsaquo;</span>
        <span>REVIEW</span>
        <span className="mx-3">&rsaquo;</span>
        <span>CONFIRMATION</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Column */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          
          {/* Step 1: Delivery Address */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-800 text-white flex items-center justify-center font-bold shrink-0">
                  1
                </div>
                <h2 className="text-xl font-bold text-gray-900">Delivery Address</h2>
              </div>
              {user && (
                <Link href="/dashboard/addresses" className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:underline">
                  <MapPin className="w-4 h-4" /> Manage profile addresses
                </Link>
              )}
            </div>

            {!authLoading && !user && (
              <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                You can check out as a guest. This address will be used for this order only. Sign in if you want it saved to your profile.
              </div>
            )}

            {user && addresses.length > 0 && (
              <div className="mb-5 grid grid-cols-2 rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setAddressMode("saved")}
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${addressMode === "saved" ? "bg-white text-blue-800 shadow-sm" : "text-gray-600"}`}
                >
                  Saved addresses
                </button>
                <button
                  type="button"
                  onClick={() => setAddressMode("manual")}
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${addressMode === "manual" ? "bg-white text-blue-800 shadow-sm" : "text-gray-600"}`}
                >
                  Enter manually
                </button>
              </div>
            )}

            {addressMode === "saved" && user && addresses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((address) => {
                  const isSelected = String(address._id) === String(selectedAddressId);
                  return (
                    <button
                      type="button"
                      key={address._id}
                      onClick={() => setSelectedAddressId(String(address._id))}
                      className={`text-left border rounded-lg p-5 relative transition-colors ${isSelected ? "border-2 border-blue-600 bg-blue-50/20" : "border border-gray-200 hover:border-gray-300"}`}
                    >
                      {isSelected && <CheckCircle2 className="absolute right-4 top-4 h-5 w-5 text-blue-600" />}
                      <span className="bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-3 inline-block">
                        {address.label}
                      </span>
                      <h3 className="font-semibold text-gray-900 mb-1">{address.fullName}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">
                        {address.line1}
                        {address.line2 ? <><br />{address.line2}</> : null}
                        <br />
                        {address.city}{address.province ? `, ${address.province}` : ""} {address.postalCode}
                      </p>
                      <p className="text-sm font-medium text-gray-900">{address.phone}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-4 md:col-span-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Fill the address from your location</p>
                      <p className="mt-1 text-xs text-gray-600">Your browser will ask for permission. Please confirm the detected street and house number.</p>
                    </div>
                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      disabled={locating}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
                    >
                      {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                      {locating ? "Finding address..." : "Use my current location"}
                    </button>
                  </div>
                  {locationError && <p className="mt-3 text-xs font-medium text-red-600">{locationError}</p>}
                  <p className="mt-2 text-[11px] text-gray-500">
                    Address lookup by <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a>
                  </p>
                </div>
                <label className="text-sm font-medium text-gray-700">
                  Address label
                  <input value={manualAddress.label} onChange={(event) => updateManualAddress("label", event.target.value)} className={`mt-1.5 ${addressInputClass}`} placeholder="Home or Office" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Full name <span className="text-red-500">*</span>
                  <input value={manualAddress.fullName} onChange={(event) => updateManualAddress("fullName", event.target.value)} className={`mt-1.5 ${addressInputClass}`} autoComplete="name" required />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Phone number <span className="text-red-500">*</span>
                  <input value={manualAddress.phone} onChange={(event) => updateManualAddress("phone", event.target.value)} className={`mt-1.5 ${addressInputClass}`} autoComplete="tel" required />
                </label>
                <label className="text-sm font-medium text-gray-700 md:col-span-2">
                  Address line 1 <span className="text-red-500">*</span>
                  <input value={manualAddress.line1} onChange={(event) => updateManualAddress("line1", event.target.value)} className={`mt-1.5 ${addressInputClass}`} autoComplete="address-line1" required />
                </label>
                <label className="text-sm font-medium text-gray-700 md:col-span-2">
                  Address line 2
                  <input value={manualAddress.line2} onChange={(event) => updateManualAddress("line2", event.target.value)} className={`mt-1.5 ${addressInputClass}`} autoComplete="address-line2" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  City <span className="text-red-500">*</span>
                  <input value={manualAddress.city} onChange={(event) => updateManualAddress("city", event.target.value)} className={`mt-1.5 ${addressInputClass}`} autoComplete="address-level2" required />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Province
                  <input value={manualAddress.province} onChange={(event) => updateManualAddress("province", event.target.value)} className={`mt-1.5 ${addressInputClass}`} autoComplete="address-level1" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Postal code
                  <input value={manualAddress.postalCode} onChange={(event) => updateManualAddress("postalCode", event.target.value)} className={`mt-1.5 ${addressInputClass}`} autoComplete="postal-code" />
                </label>
                {user && (
                  <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
                    <input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-700" />
                    Save this address to my profile
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Payment Method */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-blue-800 text-white flex items-center justify-center font-bold shrink-0">
                2
              </div>
              <h2 className="text-xl font-bold text-gray-900">Payment Method</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <button
                type="button"
                disabled
                className="font-medium rounded-lg py-3 flex items-center justify-center gap-2 border border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
              >
                <CreditCard className="w-5 h-5" /> Card (coming soon)
              </button>
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`font-medium rounded-lg py-3 flex items-center justify-center gap-2 cursor-pointer ${
                  paymentMethod === "cash"
                    ? "border-2 border-blue-600 text-blue-800 bg-blue-50/20"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Banknote className="w-5 h-5" /> Cash
              </button>
            </div>

            <p className="mt-4 text-sm text-gray-500">Online card processing will be enabled when a payment gateway is connected. Cash on delivery is fully supported now.</p>
          </div>

          {/* Step 3: Review Order */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-blue-800 text-white flex items-center justify-center font-bold shrink-0">
                3
              </div>
              <h2 className="text-xl font-bold text-gray-900">Review Order</h2>
            </div>

            <div className="space-y-4">
              {checkoutItems.length === 0 ? (
                <div className="text-gray-500 text-sm">No items in cart.</div>
              ) : (
                checkoutItems.map((item) => (
                  <div key={item.cartItemId} className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 text-2xl">
                      {item.image || "💊"}
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      <p className="text-xs text-gray-500">{item.category || "General"} • {item.pharmacyName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900">{formatPKR(item.price * item.quantity)}</p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Selected Address Preview */}
          {checkoutAddress && (usingSavedAddress || manualAddressValid) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Deliver To</h3>
              <p className="font-semibold text-gray-900">{checkoutAddress.fullName}</p>
              <p className="text-sm text-gray-600">{checkoutAddress.line1}</p>
              {checkoutAddress.line2 ? <p className="text-sm text-gray-600">{checkoutAddress.line2}</p> : null}
              <p className="text-sm text-gray-600">{checkoutAddress.city}{checkoutAddress.province ? `, ${checkoutAddress.province}` : ""} {checkoutAddress.postalCode}</p>
              <p className="text-sm text-gray-900 mt-1">{checkoutAddress.phone}</p>
            </div>
          )}
        </div>

        {/* Right Column - Order Summary */}
        <div className="w-full lg:w-1/3">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Summary</h2>

            <div className="space-y-4 mb-6 text-sm">
              <div className="flex justify-between items-center text-gray-600">
                <span>Subtotal ({checkoutItemCount} items)</span>
                <span>{formatPKR(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Delivery Fee</span>
                <span className="text-teal-600 font-medium">{deliveryFee === 0 ? "FREE" : formatPKR(deliveryFee)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Pharmacy Tax</span>
                <span>{formatPKR(tax)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Processing Fee</span>
                <span>{formatPKR(processingFee)}</span>
              </div>
            </div>

            <hr className="border-gray-200 mb-6" />

            <div className="flex justify-between items-end mb-8">
              <span className="text-xl font-bold text-gray-900">Total</span>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Estimated Total</p>
                <p className="text-3xl font-bold text-blue-800">{formatPKR(total)}</p>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={placingOrder || authLoading || checkoutItems.length === 0 || (usingSavedAddress ? !selectedAddress : !manualAddressValid)}
              className="w-full bg-blue-800 text-white font-medium py-3 rounded-lg hover:bg-blue-900 transition-colors flex items-center justify-center gap-2 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {placingOrder ? "Placing Order..." : "Confirm & Place Order"} <ChevronRight className="w-5 h-5" />
            </button>
            {checkoutError && <p className="text-sm text-red-600 text-center mb-3">{checkoutError}</p>}

            <p className="text-[10px] text-gray-500 text-center leading-relaxed mb-6 px-4">
              By placing your order, you agree to DawaConnect's <a href="#" className="underline">Terms of Clinical Service</a> and <a href="#" className="underline">Privacy Policy</a>.
            </p>

            <div className="bg-teal-50 border border-teal-100 rounded-lg p-4 flex gap-3">
              <Info className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-teal-900 text-sm mb-1">Guaranteed Delivery</h4>
                <p className="text-xs text-teal-800/80">Your medical supplies will be delivered within 24-48 clinical hours.</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default function Checkout() {
  return <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-20 text-center text-gray-500">Preparing checkout…</div>}><CheckoutContent /></Suspense>;
}
