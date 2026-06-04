'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Tabs } from '@/components/tabs';
import type { RegistrationStatus } from '@/lib/registration-types';
import type { RiskTierFilterToken } from './registration-filter-logic';

/**
 * BUG-3 gatekeeper queue filters (URL-driven), refined by BUG-4.
 *
 * The console previously hardcoded `?status=pending_approval` and offered no
 * filter UI. The backend + BFF already accept `?status=` (the BFF route
 * forwards `searchParams.toString()`), so status filtering stays server-side:
 * the RSC reads `?status=` → builds the BFF query, and this client bar drives
 * the URL so the RSC re-fetches on every filter change.
 *
 * Two filters:
 *  - Status — a tab strip (Pending / Approved / Rejected / All), mirroring the
 *    Request Management `DirectionTabs` convention via the shared `<Tabs>`
 *    primitive. Default (no `status` param) = Pending, preserving today's
 *    landing. "All" omits the param. (Unchanged.)
 *  - Risk tier — a single-pick dropdown (All / Standard / Foreign / Sanctioned),
 *    mirroring the Request Management `FilterBar` dropdown convention.
 *
 * BUG-4: the risk-tier filter is NON-EXCLUSIVE and mirrors the pill display
 * (RiskTierPills), where a `blocked` request shows BOTH a "Foreign" and a
 * "Sanctioned" pill — sanctioned IS foreign. So the URL now carries the
 * *display token* (`?risk_tier=standard|foreign|sanctioned`), NOT the
 * underlying enum, and "Foreign" and "Sanctioned" intentionally overlap (a
 * blocked row appears under both). Because the backend only does an exact
 * single-tier match, it can't express "elevated OR blocked"; the RSC stops
 * forwarding `risk_tier` to the BFF and applies `riskTierMatches` over the
 * returned rows instead. "All" omits the param.
 *
 * Other query params are preserved across either change.
 */

type StatusTab = RegistrationStatus | 'all';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'pending_approval', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

function isStatus(v: string): v is RegistrationStatus {
  return v === 'pending_approval' || v === 'approved' || v === 'rejected';
}

// Display label → display token (BUG-4). The token, NOT the risk_tier enum, is
// what travels in the URL and what `riskTierMatches` consumes. The empty value
// is the "All" sentinel (no risk_tier param).
const RISK_TIER_OPTIONS: { value: RiskTierFilterToken | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'standard', label: 'Standard' },
  { value: 'foreign', label: 'Foreign' },
  { value: 'sanctioned', label: 'Sanctioned' },
];

function isRiskTierToken(v: string): v is RiskTierFilterToken {
  return v === 'standard' || v === 'foreign' || v === 'sanctioned';
}

export function RegistrationsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusRaw = searchParams.get('status') ?? '';
  // The default landing (no `status` param) is Pending. "All" is an explicit
  // `status=all` sentinel so it's actually reachable and distinct from the
  // no-param default — otherwise omitting the param would be ambiguous with
  // Pending. The RSC treats `status=all` (and any other non-status value) as
  // "no status filter".
  const activeStatus: StatusTab = isStatus(statusRaw)
    ? statusRaw
    : statusRaw === 'all'
      ? 'all'
      : 'pending_approval';

  const riskTierRaw = searchParams.get('risk_tier') ?? '';
  const activeRiskTier: RiskTierFilterToken | '' = isRiskTierToken(riskTierRaw)
    ? riskTierRaw
    : '';

  function pushWith(sp: URLSearchParams) {
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onStatusChange(next: string) {
    const sp = new URLSearchParams(searchParams.toString());
    // Pending is the implicit default → drop the param to keep URLs clean.
    // "All" is an explicit `status=all` sentinel (so it's distinct from the
    // no-param default). Approved/Rejected set their literal value.
    if (next === 'pending_approval') {
      sp.delete('status');
    } else {
      sp.set('status', next);
    }
    pushWith(sp);
  }

  function onRiskTierChange(next: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set('risk_tier', next);
    else sp.delete('risk_tier');
    pushWith(sp);
  }

  return (
    <div className="space-y-3">
      <Tabs
        tabs={STATUS_TABS}
        active={activeStatus}
        onChange={onStatusChange}
      />
      <div
        role="group"
        aria-label="Filters"
        className="flex flex-wrap items-center gap-2"
      >
        <label className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate">Risk tier:</span>
          <select
            aria-label="Risk tier"
            value={activeRiskTier}
            onChange={(e) => onRiskTierChange(e.target.value)}
            title="Filter the queue by jurisdiction risk tier. Default: all tiers."
            className="rounded-md border border-slate/30 px-2 py-1 text-xs"
          >
            {RISK_TIER_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
