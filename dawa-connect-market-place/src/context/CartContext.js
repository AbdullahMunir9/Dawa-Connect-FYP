"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

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
  const skipNextSyncRef = useRef(false);
  const prevUserIdRef = useRef(undefined);
  const itemsRef = useRef([]);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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

  const addToCart = (item) => {
    if (!item?.cartItemId) return;
    setItems((prev) => {
      const index = prev.findIndex((existing) => existing.cartItemId === item.cartItemId);
      if (index === -1) return [...prev, { ...item, quantity: item.quantity || 1 }];

      const next = [...prev];
      next[index] = { ...next[index], quantity: next[index].quantity + (item.quantity || 1) };
      return next;
    });
  };

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

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, addToCart, updateQuantity, removeFromCart, clearCart, totalItems }),
    [items, totalItems]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
