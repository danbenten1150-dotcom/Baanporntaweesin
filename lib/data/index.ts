'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IS_DEMO } from '../config';
import type { DataApi } from './api';
import { DATA_EVENT } from './api';
import { DemoApi } from './demo';
import { startRealtime, SupabaseApi } from './supabase';

/** The one data-access object the UI talks to. Swaps automatically on env vars. */
export const api: DataApi = IS_DEMO ? new DemoApi() : new SupabaseApi();

/** Tiny query hook: loading / error / data, refreshes whenever data changes. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (api.mode === 'supabase') startRealtime();
    run();
    const h = () => run(true);
    window.addEventListener(DATA_EVENT, h);
    window.addEventListener('storage', h);
    return () => { window.removeEventListener(DATA_EVENT, h); window.removeEventListener('storage', h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: run };
}

export { quotationTotal } from './api';
export type { DataApi } from './api';
