import type { RiskTier } from '@/lib/registration-types';

/**
 * Risk-tier filter display tokens. These are what the URL carries
 * (`?risk_tier=foreign`) and what the dropdown options select — deliberately
 * NOT the underlying `risk_tier` enum. The empty string is the "All" sentinel
 * (no filter).
 */
export type RiskTierFilterToken = 'standard' | 'foreign' | 'sanctioned';

/**
 * BUG-4: NON-EXCLUSIVE, display-aligned risk-tier matching.
 *
 * The pill display (RiskTierPills) renders `blocked` as BOTH a "Foreign" and a
 * "Sanctioned" pill — a sanctioned jurisdiction IS foreign. The filter mirrors
 * that, so the Foreign and Sanctioned filters intentionally overlap (a blocked
 * row appears under both):
 *
 *   standard token   → risk_tier === 'standard'
 *   foreign token    → risk_tier === 'elevated' || risk_tier === 'blocked'
 *   sanctioned token → risk_tier === 'blocked'
 *   '' / undefined   → matches everything (All)
 *
 * The backend `?risk_tier=` only does an exact single-tier match, so it cannot
 * express "elevated OR blocked"; this predicate is applied client/RSC-side over
 * the already-fetched rows instead.
 *
 * An unrecognized token is treated defensively as "All" (matches everything).
 */
export function riskTierMatches(
  rowTier: RiskTier,
  filter: string | undefined,
): boolean {
  switch (filter) {
    case 'standard':
      return rowTier === 'standard';
    case 'foreign':
      return rowTier === 'elevated' || rowTier === 'blocked';
    case 'sanctioned':
      return rowTier === 'blocked';
    default:
      // '', undefined, or anything unrecognized → no filter (All).
      return true;
  }
}
