// Domestic-origin qualification helpers — the single definition used by every
// audit surface (run history Domestic column, run-detail SKU rows, evidence
// trees). Geography is a primary concern on audit reports: a SKU only earns
// the auditor-country flag when its ENTIRE component tree is resolved and
// domestic; a vendor line earns it when its own origin is resolved + domestic.

import type { GeoRollupEntry } from '@haiwave/protocol';
import { FLAG_COMPONENTS } from './country-flags';

// Sentinel used by haiCore's geo-rollup builder for components that couldn't
// be resolved to an ISO-2 country (GeoRollupEntrySchema, protocol
// audit/traversal.ts). Tree-node origins additionally use the older
// '<unknown>' sentinel — both count as "not resolved".
const UNKNOWN_ORIGIN = '<unknown>';
const UNKNOWN_ISO = 'XX';

/**
 * A SKU is fully domestic when every component in its geo rollup resolved to
 * the auditor's country: any unresolved ('XX' / '<unknown>') or foreign entry
 * disqualifies. An empty rollup is NOT domestic — nothing was verified.
 */
export function isFullyDomestic(
  geoRollup: GeoRollupEntry[],
  auditorCountry: string,
): boolean {
  if (geoRollup.length === 0) return false;
  // The single `every` covers unresolved entries too — sentinels never equal
  // an ISO-2 country code.
  return geoRollup.every((e) => e.country_of_origin === auditorCountry);
}

/**
 * A single vendor/tree-node origin qualifies as domestic when it is resolved
 * (not a sentinel, not empty) and equals the auditor's country.
 */
export function isDomesticOrigin(
  countryOfOrigin: string | null | undefined,
  auditorCountry: string | undefined,
): boolean {
  if (!auditorCountry || !countryOfOrigin) return false;
  if (countryOfOrigin === UNKNOWN_ISO || countryOfOrigin === UNKNOWN_ORIGIN) return false;
  return countryOfOrigin === auditorCountry;
}

/**
 * Small inline flag badge. Renders nothing when no SVG asset exists for the
 * country, so callers can use it unconditionally behind their qualification
 * check.
 */
export function DomesticFlagBadge({
  country,
  title,
  className = 'h-3.5 w-auto rounded-sm shadow-sm',
}: {
  country: string;
  title: string;
  className?: string;
}) {
  const FlagComponent = FLAG_COMPONENTS[country];
  if (!FlagComponent) return null;
  return (
    <span className="inline-flex items-center" title={title} aria-label={title}>
      <FlagComponent className={className} />
    </span>
  );
}
