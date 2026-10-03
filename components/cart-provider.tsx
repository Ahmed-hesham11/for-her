"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/storefront-data";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";

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
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
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

  const addToCart = useCallback(async (product: Product, quantity = 1) => {
    if (!user) {
      router.push("/login");
      return;
    }

    setError("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, quantity }),
      });
      const nextItems = await parseItems(response);
      if (nextItems === null) setError(t.cart.addError);
      else setItems(nextItems);
    } catch {
      setError(t.cart.addError);
    }
  }, [user, router, t]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (!user) return;

    setError("");
    try {
      const response = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity }),
      });
      const nextItems = await parseItems(response);
      if (nextItems === null) setError(t.cart.updateError);
      else setItems(nextItems);
    } catch {
      setError(t.cart.updateError);
    }
  }, [user, t]);

  const removeFromCart = useCallback(async (productId: string) => {
    if (!user) return;

    setError("");
    try {
      const response = await fetch(`/api/cart?product_id=${encodeURIComponent(productId)}`, { method: "DELETE" });
      const nextItems = await parseItems(response);
      if (nextItems === null) setError(t.cart.removeError);
      else setItems(nextItems);
    } catch {
      setError(t.cart.removeError);
    }
  }, [user, t]);

  const clearCart = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    try {
      const response = await fetch("/api/cart", { method: "DELETE" });
      const nextItems = await parseItems(response);
      if (nextItems === null) setError(t.cart.clearError);
      else setItems(nextItems);
    } catch {
      setError(t.cart.clearError);
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
