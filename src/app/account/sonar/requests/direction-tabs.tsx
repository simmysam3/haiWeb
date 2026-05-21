'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Tabs } from '@/components/tabs';

/**
 * v.1.37 Request Management — direction filter tab strip (URL-driven).
 *
 * Three mutually exclusive values: `me` (action sits with this org), `them`
 * (waiting on the counterparty), `all` (no direction filter). State lives in
 * the URL as `?direction=me|them|all`; default = `me`. Other query params
 * (item_type, state, counterparty, age_bucket) are preserved across tab
 * switches so a filtered list stays filtered when you flip direction.
 *
 * Wraps the project's shared `<Tabs>` primitive so the active/inactive
 * styling, count chip, and underline match every other tabbed surface in the
 * portal (partners, manifests, provenance, etc.).
 */

export type DirectionTabValue = 'me' | 'them' | 'all';

interface DirectionTabsProps {
  awaitingMeCount: number;
  awaitingThemCount: number;
  totalCount: number;
}

function isDirection(v: string): v is DirectionTabValue {
  return v === 'me' || v === 'them' || v === 'all';
}

export function DirectionTabs({
  awaitingMeCount,
  awaitingThemCount,
  totalCount,
}: DirectionTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Legacy `awaiting` alias still arrives from the v1.35 301 redirects.
  const raw = searchParams.get('direction') ?? searchParams.get('awaiting') ?? '';
  const active: DirectionTabValue = isDirection(raw) ? raw : 'me';

  function onChange(next: string) {
    const sp = new URLSearchParams(searchParams.toString());
    // 'me' is the implicit default — drop the param (and the legacy `awaiting`
    // alias from v1.35 redirects) to keep URLs clean.
    if (next === 'me') {
      sp.delete('direction');
      sp.delete('awaiting');
    } else {
      sp.set('direction', next);
      sp.delete('awaiting');
    }
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const tabs = [
    { key: 'me', label: 'Awaiting me', count: awaitingMeCount },
    { key: 'them', label: 'Awaiting them', count: awaitingThemCount },
    { key: 'all', label: 'All', count: totalCount },
  ];

  return <Tabs tabs={tabs} active={active} onChange={onChange} />;
}
