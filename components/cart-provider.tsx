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

// An optimistically-added line has no server id yet; this prefix marks it.
const PENDING_PREFIX = "pending:";

// One cart line = one (product, color, size) combination. `id` is the product
// id; `lineId` identifies the line itself (used for quantity edits/removal).
export type CartItem = {
  lineId: string;
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  colorId: string | null;
  colorName: string | null;
  sizeId: string | null;
  sizeName: string | null;
};

export type CartOptions = {
  colorId?: string | null;
  colorName?: string | null;
  sizeId?: string | null;
  sizeName?: string | null;
  // The selected color's image, so the optimistic line matches what the
  // server will return.
  image?: string | null;
};

type CartStateValue = {
  items: CartItem[];
  cartCount: number;
  subtotal: number;
  isLoading: boolean;
  error: string;
};

type CartActionsValue = {
  addToCart: (product: Product, quantity?: number, options?: CartOptions) => Promise<void>;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeFromCart: (lineId: string) => Promise<void>;
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
  // Pending debounce timers for in-flight quantity edits, one per cart line.
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
  const addToCart = useCallback(async (product: Product, quantity = 1, options: CartOptions = {}) => {
    if (!user) {
      router.push("/login");
      return;
    }

    const colorId = options.colorId ?? null;
    const sizeId = options.sizeId ?? null;
    const sameLine = (item: CartItem) => item.id === product.id && item.colorId === colorId && item.sizeId === sizeId;

    setError("");
    setItems((current) => {
      if (current.some(sameLine)) {
        return current.map((item) => (sameLine(item) ? { ...item, quantity: item.quantity + quantity } : item));
      }
      return [
        ...current,
        {
          lineId: `${PENDING_PREFIX}${product.id}:${colorId ?? ""}:${sizeId ?? ""}`,
          id: product.id,
          name: product.name,
          price: product.price,
          image: options.image || product.image,
          quantity,
          colorId,
          colorName: options.colorName ?? null,
          sizeId,
          sizeName: options.sizeName ?? null,
        },
      ];
    });

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, quantity, color_id: colorId, size_id: sizeId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        // The server's message is specific for option problems ("Please choose a size.").
        setError(typeof body?.error === "string" && response.status === 400 ? body.error : t.cart.addError);
        void loadCart();
        return;
      }
      setItems((body.items ?? []) as CartItem[]);
    } catch {
      setError(t.cart.addError);
      void loadCart();
    }
  }, [user, router, t, loadCart]);

  const flushQuantity = useCallback(async (lineId: string, quantity: number) => {
    // An add that hasn't come back from the server yet has no real line id;
    // reload to pick up the authoritative cart instead of PATCHing a placeholder.
    if (lineId.startsWith(PENDING_PREFIX)) {
      void loadCart();
      return;
    }
    try {
      const response = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: lineId, quantity }),
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
  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    if (!user) return;
    const nextQuantity = Math.max(0, Math.floor(quantity));

    setError("");
    setItems((current) =>
      nextQuantity <= 0
        ? current.filter((item) => item.lineId !== lineId)
        : current.map((item) => (item.lineId === lineId ? { ...item, quantity: nextQuantity } : item)),
    );

    const pendingTimer = quantityTimers.current.get(lineId);
    if (pendingTimer) clearTimeout(pendingTimer);
    quantityTimers.current.set(
      lineId,
      setTimeout(() => {
        quantityTimers.current.delete(lineId);
        void flushQuantity(lineId, nextQuantity);
      }, QUANTITY_SYNC_DELAY_MS),
    );
  }, [user, flushQuantity]);

  const removeFromCart = useCallback(async (lineId: string) => {
    if (!user) return;
    if (pendingRemoveRef.current.has(lineId)) return;
    pendingRemoveRef.current.add(lineId);

    // A pending quantity edit for this item is now moot — drop it so it
    // can't fire after the item is already gone.
    const pendingTimer = quantityTimers.current.get(lineId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      quantityTimers.current.delete(lineId);
    }

    setError("");
    let removedItem: CartItem | undefined;
    setItems((current) => {
      removedItem = current.find((item) => item.lineId === lineId);
      return current.filter((item) => item.lineId !== lineId);
    });

    if (lineId.startsWith(PENDING_PREFIX)) {
      // Not saved yet — nothing to delete server-side; reload to settle.
      pendingRemoveRef.current.delete(lineId);
      void loadCart();
      return;
    }

    try {
      const response = await fetch(`/api/cart?item_id=${encodeURIComponent(lineId)}`, { method: "DELETE" });
      const nextItems = await parseItems(response);
      if (nextItems === null) throw new Error("remove failed");
      setItems(nextItems);
    } catch {
      setError(t.cart.removeError);
      const restored = removedItem;
      if (restored) {
        setItems((current) => (current.some((item) => item.lineId === restored.lineId) ? current : [...current, restored]));
      }
    } finally {
      pendingRemoveRef.current.delete(lineId);
    }
  }, [user, t, loadCart]);

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
