"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface CartItem {
  pageId: string;
  orderId: string;
  imageUrl: string;
  characterName: string;
  pageNumber: number;
}

interface MixMatchCartContextValue {
  items: CartItem[];
  addPage: (item: CartItem) => void;
  removePage: (pageId: string) => void;
  isInCart: (pageId: string) => boolean;
  clearCart: () => void;
  totalCents: number;
  pageCount: number;
  /** True for 3 seconds after the very first item is added to an empty cart */
  firstAddNotification: boolean;
}

const MixMatchCartContext = createContext<MixMatchCartContextValue | null>(null);

const STORAGE_KEY = "mm-cart";

/** Price formula: $5 flat for ≤10 pages, +$0.50/page after 10 */
export function calcCartTotalCents(pageCount: number): number {
  if (pageCount === 0) return 0;
  return 500 + Math.max(0, pageCount - 10) * 50;
}

/** Format cents as a dollar string, e.g. 750 → "$7.50" */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function MixMatchCartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firstAddNotification, setFirstAddNotification] = useState(false);
  const [items, setItems] = useState<CartItem[]>(() => {
    // Lazy initializer: read from localStorage on first render (client only)
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CartItem[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore parse errors
    }
    return [];
  });

  // Persist to localStorage whenever items change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  }, [items]);

  const addPage = useCallback((item: CartItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.pageId === item.pageId)) return prev;
      // Show the first-add notification when going from 0 → 1 item
      if (prev.length === 0) {
        setFirstAddNotification(true);
        setTimeout(() => setFirstAddNotification(false), 3000);
      }
      return [...prev, item];
    });
  }, []);

  const removePage = useCallback((pageId: string) => {
    setItems((prev) => prev.filter((i) => i.pageId !== pageId));
  }, []);

  const isInCart = useCallback(
    (pageId: string) => items.some((i) => i.pageId === pageId),
    [items],
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const pageCount = items.length;
  const totalCents = calcCartTotalCents(pageCount);

  return (
    <MixMatchCartContext.Provider
      value={{ items, addPage, removePage, isInCart, clearCart, totalCents, pageCount, firstAddNotification }}
    >
      {children}
    </MixMatchCartContext.Provider>
  );
}

export function useMixMatchCart(): MixMatchCartContextValue {
  const ctx = useContext(MixMatchCartContext);
  if (!ctx) throw new Error("useMixMatchCart must be used inside MixMatchCartProvider");
  return ctx;
}
