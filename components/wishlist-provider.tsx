"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/storefront-data";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";

type WishlistStateValue = {
  items: Product[];
  productIds: Set<string>;
  wishlistCount: number;
  isLoading: boolean;
  error: string;
};

type WishlistActionsValue = {
  addToWishlist: (product: Product) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
};

// Same rationale as CartProvider's two-context split: actions that only use
// functional setState updates (never read `items` directly) stay
// referentially stable across wishlist mutations.
const WishlistStateContext = createContext<WishlistStateValue | null>(null);
const WishlistActionsContext = createContext<WishlistActionsValue | null>(null);

async function parseItems(response: Response): Promise<Product[] | null> {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) return null;
  return (body.items ?? []) as Product[];
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { t } = useLocale();
  const [items, setItems] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // Guards against a double-click (or two buttons for the same product)
  // firing overlapping requests, which would otherwise race against the
  // unique constraint / cause the UI to flicker between states.
  const pendingRef = useRef<Set<string>>(new Set());

  const loadWishlist = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/wishlist");
      const nextItems = await parseItems(response);
      if (nextItems === null) {
        setError(t.wishlist.loadError);
        setItems([]);
      } else {
        setItems(nextItems);
      }
    } catch {
      setError(t.wishlist.loadError);
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
    void loadWishlist();
  }, [user, isAuthLoading, loadWishlist]);

  const addToWishlist = useCallback(async (product: Product) => {
    if (!user) return;
    if (pendingRef.current.has(product.id)) return;
    pendingRef.current.add(product.id);

    setError("");
    setItems((current) => (current.some((item) => item.id === product.id) ? current : [product, ...current]));

    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      const nextItems = await parseItems(response);
      if (nextItems === null) {
        setError(t.wishlist.addError);
        setItems((current) => current.filter((item) => item.id !== product.id));
      } else {
        setItems(nextItems);
      }
    } catch {
      setError(t.wishlist.addError);
      setItems((current) => current.filter((item) => item.id !== product.id));
    } finally {
      pendingRef.current.delete(product.id);
    }
  }, [user, t]);

  const removeFromWishlist = useCallback(async (productId: string) => {
    if (!user) return;
    if (pendingRef.current.has(productId)) return;
    pendingRef.current.add(productId);

    setError("");
    let removedItem: Product | undefined;
    setItems((current) => {
      removedItem = current.find((item) => item.id === productId);
      return current.filter((item) => item.id !== productId);
    });

    try {
      const response = await fetch(`/api/wishlist?product_id=${encodeURIComponent(productId)}`, { method: "DELETE" });
      const nextItems = await parseItems(response);
      if (nextItems === null) throw new Error("failed");
      setItems(nextItems);
    } catch {
      setError(t.wishlist.removeError);
      const restored = removedItem;
      if (restored) {
        setItems((current) => (current.some((item) => item.id === restored.id) ? current : [...current, restored]));
      }
    } finally {
      pendingRef.current.delete(productId);
    }
  }, [user, t]);

  const stateValue = useMemo<WishlistStateValue>(() => ({
    items,
    productIds: new Set(items.map((item) => item.id)),
    wishlistCount: items.length,
    isLoading,
    error,
  }), [items, isLoading, error]);

  const actionsValue = useMemo<WishlistActionsValue>(
    () => ({ addToWishlist, removeFromWishlist }),
    [addToWishlist, removeFromWishlist],
  );

  return (
    <WishlistActionsContext.Provider value={actionsValue}>
      <WishlistStateContext.Provider value={stateValue}>{children}</WishlistStateContext.Provider>
    </WishlistActionsContext.Provider>
  );
}

export function useWishlistState() {
  const context = useContext(WishlistStateContext);
  if (!context) {
    throw new Error("useWishlistState must be used within a WishlistProvider");
  }
  return context;
}

export function useWishlistActions() {
  const context = useContext(WishlistActionsContext);
  if (!context) {
    throw new Error("useWishlistActions must be used within a WishlistProvider");
  }
  return context;
}

export function useWishlist() {
  const state = useWishlistState();
  const actions = useWishlistActions();
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}
