"use client";

import { useState, useEffect, useCallback } from "react";

interface UseApiOptions<T> {
  url: string;
  fallback: T;
  enabled?: boolean;
}

interface UseApiResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Client-side hook for calling BFF API routes.
 * Falls back to provided default on error.
 */
export function useApi<T>({ url, fallback, enabled = true }: UseApiOptions<T>): UseApiResult<T> {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((json: T) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setData(fallback);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, enabled, trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch };
}
