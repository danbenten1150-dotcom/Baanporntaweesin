'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CartLine } from './types';

interface CartCtx {
  lines: CartLine[];
  count: number;
  add: (product_id: string, qty?: number) => void;
  setQty: (product_id: string, qty: number) => void;
  remove: (product_id: string) => void;
  clear: () => void;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = 'bpt.cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setLines(JSON.parse(raw)); } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  }, [lines, ready]);

  const value = useMemo<CartCtx>(() => ({
    lines,
    count: lines.length,
    add: (id, qty = 1) => setLines((ls) => {
      const f = ls.find((l) => l.product_id === id);
      return f ? ls.map((l) => (l.product_id === id ? { ...l, qty: l.qty + qty } : l)) : [...ls, { product_id: id, qty }];
    }),
    setQty: (id, qty) => setLines((ls) => ls.map((l) => (l.product_id === id ? { ...l, qty: Math.max(0.5, qty) } : l))),
    remove: (id) => setLines((ls) => ls.filter((l) => l.product_id !== id)),
    clear: () => setLines([]),
  }), [lines]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be inside CartProvider');
  return c;
}
