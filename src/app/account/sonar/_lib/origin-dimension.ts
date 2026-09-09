import type { AuditRunResult, GeoRollupEntry } from '@haiwave/protocol';

/**
 * D-219 (2026-09-08): the three origin dimensions every audit surface can show. Manufacturing is
 * the one the surfaces always showed; design and firmware arrived with D-218 (protocol 3.86.0) as
 * sibling rollups on each result row.
 */
export type Dimension = 'manufacturing' | 'design' | 'firmware';
export const DIMENSIONS: readonly Dimension[] = ['manufacturing', 'design', 'firmware'];
export const DIMENSION_LABEL: Record<Dimension, string> = {
  manufacturing: 'Manufacturing',
  design: 'Design',
  firmware: 'Firmware',
};

// haiCore's rollup bucket for a component whose country could not be resolved, and the older
// tree-node sentinel — neither is a country (see audit/_lib/domestic.tsx).
const UNKNOWN_ORIGIN = '<unknown>';
const UNKNOWN_ISO = 'XX';

/** The result's rollup for one dimension; [] when a pre-3.86.0 haiCore sent none. */
export function rollupFor(result: AuditRunResult, dimension: Dimension): GeoRollupEntry[] {
  switch (dimension) {
    case 'manufacturing':
      return result.geo_rollup;
    case 'design':
      return result.design_geo_rollup ?? [];
    case 'firmware':
      return result.firmware_geo_rollup ?? [];
  }
}

/** Distinct resolved countries, most components first; the unknown buckets are not countries. */
export function resolvedCountriesOf(rollup: GeoRollupEntry[]): string[] {
  const out: string[] = [];
  for (const e of [...rollup].sort((a, b) => b.component_count - a.component_count)) {
    const c = e.country_of_origin;
    if (c === UNKNOWN_ORIGIN || c === UNKNOWN_ISO || out.includes(c)) continue;
    out.push(c);
  }
  return out;
}

const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

/** "China" for CN; the code itself when Intl does not know it (a sentinel or a bad code). */
export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  // CLDR's own "unknown region" sentinel: some ICU builds resolve it to the literal string
  // "Unknown Region" instead of leaving it unresolved, so it needs the same code-fallback as
  // any other code Intl does not know.
  if (code === UNKNOWN_ISO || code === 'ZZ') return code;
  try {
    return REGION_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}
