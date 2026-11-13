"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Heart, TriangleAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const FavouritesContext = createContext(null);

export function favouriteKey(product) {
  const productId = String(product?.productId || product?.id || "");
  const pharmacyId = String(product?.pharmacyId || "");
  return productId && pharmacyId ? `${pharmacyId}:${productId}` : "";
}

export function FavouritesProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingKeys, setPendingKeys] = useState([]);
  const [notice, setNotice] = useState(null);
  const noticeTimerRef = useRef(null);

  const showNotice = useCallback((message, tone = "success") => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ message, tone });
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      const response = await fetch("/api/saved", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Favourites could not be loaded.");
      const next = Array.isArray(data.savedItems) ? data.savedItems : [];
      setItems(next);
      return next;
    } catch (error) {
      console.error("Load favourites error:", error);
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const byKey = useMemo(() => new Map(items.map((item) => [favouriteKey(item), item])), [items]);

  const toggleFavourite = useCallback(async (product) => {
    if (!user?.id) throw Object.assign(new Error("Sign in to save favourites."), { code: "AUTH_REQUIRED" });
    const key = favouriteKey(product);
    if (!key || pendingKeys.includes(key)) return;
    setPendingKeys((current) => [...current, key]);
    try {
      const existing = byKey.get(key);
      if (existing) {
        const response = await fetch(`/api/saved?id=${encodeURIComponent(existing._id)}`, { method: "DELETE" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "This favourite could not be removed.");
        setItems((current) => current.filter((item) => item._id !== existing._id));
        showNotice("Item removed from favourites");
        return false;
      }

      const response = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.productId || product.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "This item could not be saved.");
      const savedId = String(data.savedItem?._id || "");
      setItems((current) => [
        { ...product, id: product.id || product.productId, productId: product.productId || product.id, _id: savedId },
        ...current.filter((item) => favouriteKey(item) !== key),
      ]);
      showNotice("Item added to favourites");
      return true;
    } catch (error) {
      showNotice(error.message || "Favourites could not be updated.", "error");
      throw error;
    } finally {
      setPendingKeys((current) => current.filter((item) => item !== key));
    }
  }, [byKey, pendingKeys, showNotice, user?.id]);

  const value = useMemo(() => ({
    items,
    loading,
    refresh,
    toggleFavourite,
    isFavourite: (product) => byKey.has(favouriteKey(product)),
    isPending: (product) => pendingKeys.includes(favouriteKey(product)),
  }), [byKey, items, loading, pendingKeys, refresh, toggleFavourite]);

  return (
    <FavouritesContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className={`fixed left-4 right-4 top-20 z-[110] mx-auto max-w-sm transition-all duration-200 sm:left-auto sm:right-6 sm:top-24 sm:mx-0 ${notice ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"}`}>
        <div className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-xl shadow-slate-900/10 ${notice?.tone === "error" ? "border-red-200" : "border-rose-200"}`}>
          <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${notice?.tone === "error" ? "bg-red-50 text-red-700" : "bg-rose-50 text-rose-600"}`}>
            {notice?.tone === "error" ? <TriangleAlert className="h-5 w-5" /> : <Heart className="h-5 w-5 fill-current" />}
            {notice?.tone !== "error" && <CheckCircle2 className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white text-emerald-600" />}
          </span>
          <p className="text-sm font-semibold text-slate-900">{notice?.message}</p>
        </div>
      </div>
    </FavouritesContext.Provider>
  );
}

export function useFavourites() {
  const context = useContext(FavouritesContext);
  if (!context) throw new Error("useFavourites must be used within FavouritesProvider");
  return context;
}
