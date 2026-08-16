import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../lib/api";

// ── Types ──────────────────────────────────────────────────────────

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => Promise<void>;
}

export interface UseMutationOptions<TBody, TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

export interface UseMutationReturn<TBody, TData> {
  mutate: (body: TBody) => Promise<TData | null>;
  loading: boolean;
  error: string | null;
  data: TData | null;
  reset: () => void;
}

// ── useApi: GET with automatic loading/error states ────────────────

/**
 * Fetch data from the API on mount (or when deps change).
 *
 * ```tsx
 * const { data, loading, error, refetch } = useApi<Project[]>("/projects");
 * ```
 */
export function useApi<T = any>(
  path: string | null,
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: !!path,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const data = await apiFetch<T>(path, { signal: controller.signal as any });
      if (!controller.signal.aborted) {
        setState({ data, loading: false, error: null });
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setState({
          data: null,
          loading: false,
          error: err?.message || "Request failed",
        });
      }
    }
  }, [path]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

// ── useMutation: POST/PUT/DELETE with loading/error states ─────────

/**
 * Perform mutations with automatic loading/error tracking.
 *
 * ```tsx
 * const { mutate, loading } = useMutation<CreateDeptBody, DeptResponse>();
 * const handleSave = () => mutate("/departments", { method: "POST", body: draft });
 * ```
 */
export function useMutation<TBody = any, TData = any>(): UseMutationReturn<
  TBody,
  TData
> & { mutate: (path: string, opts: { method?: string; body?: TBody }) => Promise<TData | null> } {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TData | null>(null);

  const mutate = useCallback(
    async (
      path: string,
      opts: { method?: string; body?: TBody } = {}
    ): Promise<TData | null> => {
      const { method = "POST", body } = opts;
      setLoading(true);
      setError(null);

      try {
        const result = await apiFetch<TData>(path, {
          method,
          body: body ? JSON.stringify(body) : undefined,
        });
        setData(result);
        setLoading(false);
        return result;
      } catch (err: any) {
        const msg = err?.message || "Request failed";
        setError(msg);
        setLoading(false);
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { mutate, loading, error, data, reset };
}

// ── useSWR-style alias for common GET patterns ─────────────────────

/**
 * Simple data fetching with deduplication for the same path.
 * Useful when multiple components need the same data.
 */
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 30_000; // 30 seconds

export function useCachedApi<T = any>(path: string | null): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>(() => {
    if (!path) return { data: null, loading: false, error: null };
    const cached = cache.get(path);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return { data: cached.data as T, loading: false, error: null };
    }
    return { data: null, loading: true, error: null };
  });

  const fetchData = useCallback(async () => {
    if (!path) return;

    try {
      const data = await apiFetch<T>(path);
      cache.set(path, { data, ts: Date.now() });
      setState({ data, loading: false, error: null });
    } catch (err: any) {
      setState({ data: null, loading: false, error: err?.message || "Failed" });
    }
  }, [path]);

  useEffect(() => {
    const cached = path ? cache.get(path) : null;
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setState({ data: cached.data as T, loading: false, error: null });
      return;
    }
    fetchData();
  }, [fetchData, path]);

  return { ...state, refetch: fetchData };
}
