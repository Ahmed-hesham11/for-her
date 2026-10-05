"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/storefront-data";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";

// How long a quantity edit waits for more clicks before it's sent to the
// server — lets several rapid +/- clicks collapse into one PATCH instead of
// one per click, while the UI itself updates on every click.
const QUANTITY_SYNC_DELAY_MS = 400;

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
};

type CartStateValue = {
  items: CartItem[];
  cartCount: number;
  subtotal: number;
  isLoading: boolean;
  error: string;
};

type CartActionsValue = {
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
};

// Split into two contexts so a cart mutation (which changes `items`, and
// therefore CartStateValue) doesn't re-render components that only need the
// action functions (e.g. every ProductCard on a grid) — those functions
// don't depend on `items` at all (the server returns the authoritative list
// on every call), so CartActionsValue stays referentially stable across
// cart mutations.
const CartStateContext = createContext<CartStateValue | null>(null);
const CartActionsContext = createContext<CartActionsValue | null>(null);

async function parseItems(response: Response): Promise<CartItem[] | null> {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) return null;
  return (body.items ?? []) as CartItem[];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { t } = useLocale();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // Guards a remove against a double-click (or two buttons for the same
  // item) firing overlapping requests — same rationale as WishlistProvider.
  const pendingRemoveRef = useRef<Set<string>>(new Set());
  // Pending debounce timers for in-flight quantity edits, one per product.
  const quantityTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = quantityTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const loadCart = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cart");
      const nextItems = await parseItems(response);
      if (nextItems === null) {
        setError(t.cart.loadError);
        setItems([]);
      } else {
        setItems(nextItems);
      }
    } catch {
      setError(t.cart.loadError);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    void loadCart();
  }, [user, isAuthLoading, loadCart]);

  // Updates the UI the instant a product is added, then syncs to the server
  // in the background — callers that await this (e.g. "Buy Now" navigating
  // straight to checkout) don't sit through a round trip first.
  const addToCart = useCallback(async (product: Product, quantity = 1) => {
    if (!user) {
      router.push("/login");
      return;
    }

    setError("");
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item));
      }
      return [...current, { id: product.id, name: product.name, price: product.price, image: product.image, quantity }];
    });

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, quantity }),
      });
      const nextItems = await parseItems(response);
      if (nextItems === null) throw new Error("add failed");
      setItems(nextItems);
    } catch {
      setError(t.cart.addError);
      void loadCart();
    }
  }, [user, router, t, loadCart]);

  const flushQuantity = useCallback(async (productId: string, quantity: number) => {
    try {
      const response = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity }),
      });
      const nextItems = await parseItems(response);
      if (nextItems === null) throw new Error("update failed");
      setItems(nextItems);
    } catch {
      setError(t.cart.updateError);
      void loadCart();
    }
  }, [t, loadCart]);

  // Applies the new quantity to the UI immediately on every click, but
  // debounces the actual server write so several quick +/- clicks collapse
  // into a single PATCH instead of one per click racing the next.
  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (!user) return;
    const nextQuantity = Math.max(0, Math.floor(quantity));

    setError("");
    setItems((current) =>
      nextQuantity <= 0
        ? current.filter((item) => item.id !== productId)
        : current.map((item) => (item.id === productId ? { ...item, quantity: nextQuantity } : item)),
    );

    const pendingTimer = quantityTimers.current.get(productId);
    if (pendingTimer) clearTimeout(pendingTimer);
    quantityTimers.current.set(
      productId,
      setTimeout(() => {
        quantityTimers.current.delete(productId);
        void flushQuantity(productId, nextQuantity);
      }, QUANTITY_SYNC_DELAY_MS),
    );
  }, [user, flushQuantity]);

  const removeFromCart = useCallback(async (productId: string) => {
    if (!user) return;
    if (pendingRemoveRef.current.has(productId)) return;
    pendingRemoveRef.current.add(productId);

    // A pending quantity edit for this item is now moot — drop it so it
    // can't fire after the item is already gone.
    const pendingTimer = quantityTimers.current.get(productId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      quantityTimers.current.delete(productId);
    }

    setError("");
    let removedItem: CartItem | undefined;
    setItems((current) => {
      removedItem = current.find((item) => item.id === productId);
      return current.filter((item) => item.id !== productId);
    });

    try {
      const response = await fetch(`/api/cart?product_id=${encodeURIComponent(productId)}`, { method: "DELETE" });
      const nextItems = await parseItems(response);
      if (nextItems === null) throw new Error("remove failed");
      setItems(nextItems);
    } catch {
      setError(t.cart.removeError);
      const restored = removedItem;
      if (restored) {
        setItems((current) => (current.some((item) => item.id === restored.id) ? current : [...current, restored]));
      }
    } finally {
      pendingRemoveRef.current.delete(productId);
    }
  }, [user, t]);

  const clearCart = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    for (const timer of quantityTimers.current.values()) clearTimeout(timer);
    quantityTimers.current.clear();

    let previousItems: CartItem[] = [];
    setItems((current) => {
      previousItems = current;
      return [];
    });

    try {
      const response = await fetch("/api/cart", { method: "DELETE" });
      const nextItems = await parseItems(response);
      if (nextItems === null) throw new Error("clear failed");
      setItems(nextItems);
    } catch {
      setError(t.cart.clearError);
      setItems(previousItems);
    }
  }, [user, t]);

  const stateValue = useMemo<CartStateValue>(() => {
    const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return { items, cartCount, subtotal, isLoading, error };
  }, [items, isLoading, error]);

  const actionsValue = useMemo<CartActionsValue>(
    () => ({ addToCart, updateQuantity, removeFromCart, clearCart }),
    [addToCart, updateQuantity, removeFromCart, clearCart],
  );

  return (
    <CartActionsContext.Provider value={actionsValue}>
      <CartStateContext.Provider value={stateValue}>{children}</CartStateContext.Provider>
    </CartActionsContext.Provider>
  );
}

function useCartState() {
  const context = useContext(CartStateContext);

  if (!context) {
    throw new Error("useCartState must be used within a CartProvider");
  }

  return context;
}

export function useCartActions() {
  const context = useContext(CartActionsContext);

  if (!context) {
    throw new Error("useCartActions must be used within a CartProvider");
  }

  return context;
}

// Full-featured hook, unchanged in shape for existing callers (SiteHeader,
// cart page, checkout). Combines both contexts, so it re-renders on cart
// mutations exactly as before — only useCartActions() avoids that.
export function useCart() {
  const state = useCartState();
  const actions = useCartActions();

  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}
