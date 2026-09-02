'use client';

import { SectionTabs, type SectionTab } from '@/components/sonar/section-tabs';

export type DashboardTab = SectionTab;

/**
 * v1.41 — the Sonar Dashboard's three surfaces (Coverage / Cross-modality /
 * Activity) used to stack in one long scroll with a sticky anchor sub-nav
 * (`DashboardSubNav`, removed). They are real tabs: exactly one panel
 * visible at a time, sections rendered server-side and handed in as
 * `content` slots.
 *
 * v1.85 — the tablist itself moved to the shared `SectionTabs` so the
 * watcher definition page can use the same accessible pattern; this wrapper
 * keeps the dashboard's name and test id.
 */
export function DashboardTabs({ tabs }: { tabs: DashboardTab[] }) {
  return (
    <SectionTabs tabs={tabs} ariaLabel="Dashboard sections" testId="dashboard-tabs" />
  );
}
