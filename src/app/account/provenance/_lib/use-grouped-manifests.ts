'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  GroupedManifestsResponse,
  ManifestsByClassResponse,
} from '@haiwave/protocol';
import { resolveTier, type ManifestsState, type SkusCell, type Tier } from './types.js';

const PRELOAD_PARALLELISM = 6;

interface Hook extends ManifestsState {
  error: string | null;
  loadClass: (classSlug: string) => Promise<void>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Bounded-parallelism runner. Spawns up to `cap` workers, each pulling
 * the next index off a shared counter until all items are processed.
 * Resolves when all workers drain.
 */
async function runWithCap<T>(items: T[], cap: number, work: (item: T) => Promise<void>) {
  let i = 0;
  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(cap, items.length); w += 1) {
    workers.push(
      (async () => {
        while (true) {
          const idx = i;
          i += 1;
          if (idx >= items.length) return;
          await work(items[idx]);
        }
      })(),
    );
  }
  await Promise.all(workers);
}

/**
 * Owns the /api/account/provenance/grouped fetch + tier resolution + the
 * SKUs-per-class cache. Small + medium tiers preload every class (capped
 * 6-in-flight); large tier defers per-class fetches until loadClass is
 * called.
 */
export function useGroupedManifests(): Hook {
  const [tier, setTier] = useState<Tier | null>(null);
  const [totalSkus, setTotalSkus] = useState(0);
  const [classes, setClasses] = useState<GroupedManifestsResponse['classes']>([]);
  const [skusByClass, setSkusByClass] = useState<Map<string, SkusCell>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const setClassValue = useCallback((slug: string, value: SkusCell) => {
    setSkusByClass((prev) => {
      const next = new Map(prev);
      next.set(slug, value);
      return next;
    });
  }, []);

  const loadClass = useCallback(
    async (classSlug: string) => {
      setClassValue(classSlug, 'loading');
      try {
        const body = await fetchJson<ManifestsByClassResponse>(
          `/api/account/provenance/grouped/${encodeURIComponent(classSlug)}`,
        );
        setClassValue(classSlug, body.skus);
      } catch {
        setClassValue(classSlug, { error: 'Could not load class' });
      }
    },
    [setClassValue],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const body = await fetchJson<GroupedManifestsResponse>(
          '/api/account/provenance/grouped',
        );
        if (cancelled) return;
        const t = resolveTier(body.total_skus);
        setTier(t);
        setTotalSkus(body.total_skus);
        setClasses(body.classes);
        if (t !== 'large') {
          await runWithCap(
            body.classes.map((c) => c.class_slug),
            PRELOAD_PARALLELISM,
            loadClass,
          );
        }
      } catch {
        if (!cancelled) setError("Couldn't load product list. Retry.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadClass]);

  return { tier, totalSkus, classes, skusByClass, error, loadClass };
}
