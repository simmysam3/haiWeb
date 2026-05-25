import type {
  ClassSummary,
  ManifestSkuRow,
  ManifestSearchMatch,
} from '@haiwave/protocol';

export type Tier = 'small' | 'medium' | 'large';

/**
 * Internal cache shape for SKUs per class. `'loading'` represents an
 * in-flight fetch; an `{ error }` object represents a failed fetch
 * (consumer can retry by calling `loadClass(slug)` again).
 */
export type SkusCell = ManifestSkuRow[] | 'loading' | { error: string };

export interface ManifestsState {
  tier: Tier | null;
  totalSkus: number;
  classes: ClassSummary[];
  skusByClass: Map<string, SkusCell>;
}

export interface SearchState {
  loading: boolean;
  matches: ManifestSearchMatch[];
  error: string | null;
}

export function resolveTier(totalSkus: number): Tier {
  if (totalSkus < 60) return 'small';
  if (totalSkus < 300) return 'medium';
  return 'large';
}
