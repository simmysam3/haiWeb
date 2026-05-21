'use client';

import { Tabs } from '@/components/tabs';

/**
 * v1.35 Request Management — direction filter tab strip.
 *
 * Presentational only: state is owned by Task 25's RequestManagementClient
 * orchestrator and threaded back in via `value` + `onChange`. Three mutually
 * exclusive values: `me` (action sits with this org), `them` (waiting on the
 * counterparty), `all` (no direction filter). Counts are passed in by the
 * parent so the tab strip stays a pure function of props.
 *
 * Wraps the project's shared `<Tabs>` primitive (`components/tabs.tsx`) so the
 * active/inactive styling, count chip, and underline match every other
 * tabbed surface in the portal (partners, manifests, provenance, etc.).
 */

export type DirectionTabValue = 'me' | 'them' | 'all';

interface DirectionTabsProps {
  value: DirectionTabValue;
  onChange: (v: DirectionTabValue) => void;
  awaitingMeCount: number;
  awaitingThemCount: number;
  totalCount: number;
}

export function DirectionTabs({
  value,
  onChange,
  awaitingMeCount,
  awaitingThemCount,
  totalCount,
}: DirectionTabsProps) {
  const tabs = [
    { key: 'me', label: 'Awaiting me', count: awaitingMeCount },
    { key: 'them', label: 'Awaiting them', count: awaitingThemCount },
    { key: 'all', label: 'All', count: totalCount },
  ];
  return (
    <Tabs
      tabs={tabs}
      active={value}
      onChange={(key) => onChange(key as DirectionTabValue)}
    />
  );
}
