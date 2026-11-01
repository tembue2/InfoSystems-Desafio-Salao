'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { managementError, type ManagementError } from './errors';

/** Pass a stable useCallback loader. Explicit refresh after a successful mutation;
 * never retry writes automatically. Stale responses cannot replace newer data.
 */
export function useManagementResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: ManagementError | null; loading: boolean }>({ data: null, error: null, loading: true });
  const generation = useRef(0);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (mounted.current) setState(previous => ({ ...previous, loading: true, error: null }));
    try {
      const data = await load();
      if (mounted.current && generation.current === request) setState({ data, loading: false, error: null });
    } catch (error) {
      if (mounted.current && generation.current === request) setState(previous => ({ ...previous, loading: false, error: managementError(error) }));
    }
  }, [load]);
  useEffect(() => {
    mounted.current = true;
    // Clear records on a new loader (e.g. account, filter or module change).
    setState({ data: null, error: null, loading: true });
    void refresh();
    return () => { mounted.current = false; generation.current++; };
  }, [refresh]);
  return { ...state, refresh };
}
