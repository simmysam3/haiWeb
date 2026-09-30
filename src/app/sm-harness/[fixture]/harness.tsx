'use client';
import '@/app/sourcing-map/sourcing-map.css';
import { SmThemeRoot } from '@/app/sourcing-map/_components/theme-root';
import { Workspace } from '@/app/sourcing-map/[projectId]/runs/[templateId]/_components/workspace';
import { multitierDetail, throttledDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import { vomeroProducts, vomeroRunTemplate } from '@/lib/sourcing-map/__fixtures__/vomero';

export type HarnessFixture = 'multitier' | 'throttled';

/**
 * The run workspace on an SP2-0 fixture, inside the app's theme root (both themes through the header's toggle).
 * The SP1 Vomero template and library carry the same product ids as the fixtures, so the seat card and the product
 * filter read as on the live seed. BFF calls the workspace makes are the harness driver's to answer (page.route).
 */
export function Harness({ fixture }: { fixture: HarnessFixture }) {
  const detail = fixture === 'multitier' ? multitierDetail : throttledDetail;
  return (
    <SmThemeRoot>
      <Workspace projectName="Spring 2027 (harness)" template={vomeroRunTemplate} library={vomeroProducts} executions={[detail.execution]} initialDetail={detail} />
    </SmThemeRoot>
  );
}
