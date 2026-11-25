'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Lang } from './types';

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Pick the string for the current language. */
  t: (th: string, en: string) => string;
  /** Pick a localized field from a record with *_th / *_en keys or {th,en}. */
  pick: (o: { th: string; en: string } | undefined | null) => string;
}

const Ctx = createContext<LangCtx | null>(null);
const KEY = 'bpt.lang';

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('th');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'en' || saved === 'th') setLangState(saved);
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  }, []);

  const value = useMemo<LangCtx>(() => ({
    lang,
    setLang,
    t: (th, en) => (lang === 'th' ? th : en),
    pick: (o) => (o ? (lang === 'th' ? o.th : o.en) : ''),
  }), [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLang must be used inside LangProvider');
  return c;
}

/** Inline bilingual text: <T th="..." en="..." /> */
export function T({ th, en }: { th: string; en: string }) {
  const { lang } = useLang();
  return <>{lang === 'th' ? th : en}</>;
}
