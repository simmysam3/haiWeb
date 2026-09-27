"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  /**
   * Applies a local change to `data` through an updater. It queues on the same state as the loads' answers, so a local
   * change and an answer apply in the order they arrived; a caller never needs its own copy of `data` to edit.
   */
  mutate: (update: (prev: T) => T) => void;
}

/**
 * Client-side hook for calling BFF API routes.
 * Falls back to provided default on error.
 */
export function useApi<T>({ url, fallback, enabled = true }: UseApiOptions<T>): UseApiResult<T> {
  const [data, setData] = useState<T>(fallback);
  // Start in "loading" state when enabled so callers that gate on
  // `!loading` across multiple hooks don't mis-read the initial render
  // as "already done" and snapshot the empty fallback.
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);
  // Bumped when refetch() is called, so the load it supersedes is dropped at once. The effect cleanup drops it too, but
  // only once the refetch has rendered; an answer landing before that would overwrite a local change made just before
  // the refetch (an invite's appended row) with data older than it.
  const generation = useRef(0);

  const refetch = useCallback(() => {
    generation.current += 1;
    setTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const started = generation.current;
    const current = () => !cancelled && generation.current === started;
    setLoading(true);
    setError(null);

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((json: T) => {
        if (current()) setData(json);
      })
      .catch((err: Error) => {
        if (current()) {
          setError(err.message);
          setData(fallback);
        }
      })
      .finally(() => {
        if (current()) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, enabled, trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch, mutate: setData };
}
