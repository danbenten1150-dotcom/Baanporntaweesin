'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { UserProfile } from './types';
import { IS_DEMO } from './config';
import { api } from './data';
import { supabase } from './data/supabase';
import { normalizePhone, uid } from './utils';

interface AuthCtx {
  user: UserProfile | null;
  loading: boolean;
  isStaff: boolean;
  /** Demo mode only: sign in as a customer identified by phone. */
  demoCustomerLogin: (phone: string, name?: string) => Promise<void>;
  /** Demo mode only: sign in as the demo administrator. */
  demoAdminLogin: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, meta: { full_name: string; phone: string; pdpa_consent: boolean }) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (p: UserProfile) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = 'bpt.session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSupabaseProfile = useCallback(async () => {
    const db = await supabase();
    const { data: { user: u } } = await db.auth.getUser();
    if (!u) { setUser(null); return; }
    const { data } = await db.from('profiles').select('*').eq('id', u.id).maybeSingle();
    const { data: addr } = await db.from('customer_addresses').select('address').eq('profile_id', u.id);
    if (data) setUser({ ...(data as UserProfile), addresses: (addr || []).map((a: { address: string }) => a.address) });
  }, []);

  useEffect(() => {
    if (IS_DEMO) {
      try { const raw = localStorage.getItem(KEY); if (raw) setUser(JSON.parse(raw)); } catch { /* ignore */ }
      setLoading(false);
      return;
    }
    loadSupabaseProfile().finally(() => setLoading(false));
    let unsub = () => {};
    supabase().then((db) => { const { data: sub } = db.auth.onAuthStateChange(() => { loadSupabaseProfile(); }); unsub = () => sub.subscription.unsubscribe(); });
    return () => unsub();
  }, [loadSupabaseProfile]);

  const persist = (u: UserProfile | null) => {
    setUser(u);
    try { if (u) localStorage.setItem(KEY, JSON.stringify(u)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
  };

  const value = useMemo<AuthCtx>(() => ({
    user, loading,
    isStaff: !!user && (user.role === 'admin' || user.role === 'staff'),
    demoCustomerLogin: async (phone, name) => {
      if (!IS_DEMO) throw new Error('demo only');
      const p = normalizePhone(phone);
      if (!/^0\d{8,9}$/.test(p)) throw new Error('phone');
      const store = await api.getStore();
      const existing = store.users.find((u) => u.phone === p && u.role === 'customer');
      const u: UserProfile = existing || { id: uid(), role: 'customer', full_name: name || 'ลูกค้า', phone: p, account_type: 'individual', addresses: [] };
      if (!existing) await api.saveProfile(u);
      persist(u);
    },
    demoAdminLogin: async () => {
      if (!IS_DEMO) throw new Error('demo only');
      const store = await api.getStore();
      persist(store.users.find((u) => u.role === 'admin') || null);
    },
    signIn: async (email, password) => {
      const { error } = await (await supabase()).auth.signInWithPassword({ email, password });
      if (error) throw error;
      await loadSupabaseProfile();
    },
    signUp: async (email, password, meta) => {
      const { error } = await (await supabase()).auth.signUp({ email, password, options: { data: { ...meta, pdpa_consent: String(meta.pdpa_consent) } } });
      if (error) throw error;
    },
    signOut: async () => {
      if (!IS_DEMO) await (await supabase()).auth.signOut();
      persist(null);
    },
    updateProfile: async (p) => {
      await api.saveProfile(p);
      if (IS_DEMO) persist(p); else setUser(p);
    },
  }), [user, loading, loadSupabaseProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be inside AuthProvider');
  return c;
}
