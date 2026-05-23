'use client';

import { useEffect, useRef, useState } from 'react';
import type { ManifestSearchResponse } from '@haiwave/protocol';
import type { SearchState } from './types.js';

const DEBOUNCE_MS = 250;

interface Hook {
  query: string;
  setQuery: (q: string) => void;
  state: SearchState;
}

/**
 * Debounced /api/account/provenance/search lookup. Trims the query;
 * skips fetches for <2-character inputs. Aborts the previous request
 * when a new keystroke arrives so stale responses can't overwrite
 * fresher results.
 */
export function useManifestSearch(): Hook {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({
    loading: false,
    matches: [],
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // Cancel any in-flight request when the query becomes too short
      // (e.g. user clears the box). Reset state to empty/no-error.
      abortRef.current?.abort();
      setState({ loading: false, matches: [], error: null });
      return;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch(
          `/api/account/provenance/search?q=${encodeURIComponent(trimmed)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as ManifestSearchResponse;
        if (ctrl.signal.aborted) return;
        setState({ loading: false, matches: body.matches, error: null });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setState({ loading: false, matches: [], error: 'Search unavailable. Try again.' });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  return { query, setQuery, state };
}
