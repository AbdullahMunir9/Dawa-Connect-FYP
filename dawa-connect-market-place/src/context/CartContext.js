"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ShoppingCart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { groupCartItemsByPharmacy } from "@/lib/cartGroups.mjs";

const CartContext = createContext(null);
const CART_STORAGE_KEY = "dawaconnect_cart_items";

function mergeItems(baseItems, incomingItems) {
  const byId = new Map();
  for (const item of baseItems) {
    if (!item?.cartItemId) continue;
    byId.set(item.cartItemId, { ...item, quantity: Math.max(1, Number(item.quantity) || 1) });
  }
  for (const item of incomingItems) {
    if (!item?.cartItemId) continue;
    const quantity = Math.max(1, Number(item.quantity) || 1);
    if (!byId.has(item.cartItemId)) {
      byId.set(item.cartItemId, { ...item, quantity });
      continue;
    }
    const existing = byId.get(item.cartItemId);
    byId.set(item.cartItemId, { ...existing, ...item, quantity: existing.quantity + quantity });
  }
  return Array.from(byId.values());
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [cartNoticeVisible, setCartNoticeVisible] = useState(false);
  const skipNextSyncRef = useRef(false);
  const prevUserIdRef = useRef(undefined);
  const itemsRef = useRef([]);
  const cartNoticeTimerRef = useRef(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => {
    if (cartNoticeTimerRef.current) clearTimeout(cartNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setItems(parsed);
        itemsRef.current = parsed;
      }
    } catch (error) {
      console.error("Failed to load cart items", error);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady || authLoading) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    const persist = async () => {
      if (user?.id) {
        try {
          await fetch("/api/cart", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
        } catch (error) {
          console.error("Failed to sync cart to server", error);
        }
        return;
      }

      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    };

    persist();
  }, [items, user?.id, authLoading, isReady]);

  useEffect(() => {
    if (!isReady || authLoading) return;

    const syncUserCart = async () => {
      const currentUserId = user?.id || null;
      const previousUserId = prevUserIdRef.current;

      if (previousUserId === undefined) {
        prevUserIdRef.current = currentUserId;
      } else if (previousUserId !== currentUserId) {
        // User switched (or logged out): clear in-memory/local cart to avoid leakage.
        skipNextSyncRef.current = true;
        setItems([]);
        itemsRef.current = [];
        localStorage.removeItem(CART_STORAGE_KEY);
        prevUserIdRef.current = currentUserId;
      }

      if (!currentUserId) return;

      try {
        const response = await fetch("/api/cart");
        if (!response.ok) return;
        const data = await response.json();
        const serverItems = Array.isArray(data?.items) ? data.items : [];
        const merged =
          previousUserId === null
            ? mergeItems(serverItems, itemsRef.current)
            : serverItems;
        skipNextSyncRef.current = true;
        setItems(merged);
        await fetch("/api/cart", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: merged }),
        });
        localStorage.removeItem(CART_STORAGE_KEY);
      } catch (error) {
        console.error("Failed to load user cart", error);
      }
    };

    syncUserCart();
  }, [user?.id, authLoading, isReady]);

  const showCartNotice = useCallback(() => {
    if (cartNoticeTimerRef.current) clearTimeout(cartNoticeTimerRef.current);
    setCartNoticeVisible(true);
    cartNoticeTimerRef.current = setTimeout(() => {
      setCartNoticeVisible(false);
      cartNoticeTimerRef.current = null;
    }, 3000);
  }, []);

  const addToCart = useCallback((item) => {
    if (!item?.cartItemId) return;
    setItems((prev) => {
      const index = prev.findIndex((existing) => existing.cartItemId === item.cartItemId);
      if (index === -1) return [...prev, { ...item, quantity: item.quantity || 1 }];

      const next = [...prev];
      next[index] = { ...next[index], quantity: next[index].quantity + (item.quantity || 1) };
      return next;
    });
    showCartNotice();
  }, [showCartNotice]);

  const updateQuantity = (cartItemId, nextQuantity) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.cartItemId === cartItemId ? { ...item, quantity: Math.max(0, Number(nextQuantity) || 0) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (cartItemId) => {
    setItems((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => setItems([]);

  const clearPharmacyCart = (pharmacyId) => {
    const key = String(pharmacyId || "");
    setItems((prev) => prev.filter((item) => String(item.pharmacyId) !== key));
  };

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const pharmacyCarts = useMemo(() => groupCartItemsByPharmacy(items), [items]);

  const value = useMemo(
    () => ({ items, pharmacyCarts, isReady, addToCart, updateQuantity, removeFromCart, clearCart, clearPharmacyCart, totalItems }),
    [items, pharmacyCarts, isReady, addToCart, totalItems]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`fixed left-4 right-4 top-20 z-[100] mx-auto max-w-sm transition-all duration-200 sm:left-auto sm:right-6 sm:top-24 sm:mx-0 ${
          cartNoticeVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3.5 shadow-xl shadow-slate-900/10">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShoppingCart className="h-5 w-5" />
            <CheckCircle2 className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white text-emerald-600" />
          </span>
          <p className="text-sm font-semibold text-slate-900">Item added to the cart</p>
        </div>
      </div>
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
