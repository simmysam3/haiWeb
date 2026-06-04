'use client';

import { Pill } from '@/components/pill';
import type { RegistrationListItem } from '@/lib/registration-types';

type RiskTier = RegistrationListItem['risk_tier'];

/**
 * Renders the jurisdiction risk tier as one or more literal pills.
 *
 * Presentation only — the underlying `risk_tier` enum (standard|elevated|blocked)
 * is unchanged in the protocol/DB; this maps each tier to the plain-language
 * pill(s) operators read in the gatekeeper console:
 *   standard → Standard
 *   elevated → Foreign
 *   blocked  → Foreign + Sanctioned   (a sanctioned jurisdiction is also foreign)
 */
const TIER_PILL_VALUES: Record<RiskTier, string[]> = {
  standard: ['standard'],
  elevated: ['foreign'],
  blocked: ['foreign', 'sanctioned'],
};

export function RiskTierPills({ tier }: { tier: RiskTier }) {
  const values = TIER_PILL_VALUES[tier] ?? [tier];
  return (
    <>
      {values.map((value) => (
        <Pill key={value} category="risk_tier" value={value} />
      ))}
    </>
  );
}
