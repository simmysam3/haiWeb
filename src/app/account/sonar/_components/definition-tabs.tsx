'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SectionTabs } from '@/components/sonar/section-tabs';
import type { DefinitionTab } from '../_lib/definition-tab';

interface Props {
  /** Accessible name for the tablist, e.g. "Watcher sections". */
  ariaLabel: string;
  initialTab: DefinitionTab;
  /** Run history panel (server-rendered slot). */
  runs: ReactNode;
  /** Configuration panel: the definition editor. */
  configuration: ReactNode;
}

/**
 * v1.85 — a definition page (watcher or audit) shows Run history and
 * Configuration as two tabs instead of one long scroll with the editor below
 * the fold. The selected tab round-trips through `?tab=` so the list's
 * "Edit configuration" lands on the editor and Back returns to the tab you
 * left. `replace` (not `push`) so tab flips do not pile up in history.
 */
export function DefinitionTabs({ ariaLabel, initialTab, runs, configuration }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <SectionTabs
      ariaLabel={ariaLabel}
      initialId={initialTab}
      onChange={(id) => router.replace(`${pathname}?tab=${id}`, { scroll: false })}
      tabs={[
        { id: 'runs', label: 'Run history', content: runs },
        { id: 'configuration', label: 'Configuration', content: configuration },
      ]}
    />
  );
}
