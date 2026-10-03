'use client';
import '@/app/sourcing-map/sourcing-map.css';
import { SmThemeRoot } from '@/app/sourcing-map/_components/theme-root';
import { Workspace } from '@/app/sourcing-map/[projectId]/runs/[templateId]/_components/workspace';
import { multitierDetail, throttledDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import { leonExceptions, notTracedDetail, supplyRisksList } from '@/app/sourcing-map/__fixtures__/sp3';
import { SupplyRisksTable } from '@/app/account/sonar/supply-risks/_components/supply-risks-table';
import { DemandExceptionsTable } from '@/app/account/sonar/demand-exceptions/_components/demand-exceptions-table';
import { vomeroProducts, vomeroRunTemplate } from '@/lib/sourcing-map/__fixtures__/vomero';

export type HarnessFixture = 'multitier' | 'throttled' | 'not-traced' | 'supply-risks' | 'demand-exceptions';

/**
 * The run workspace on an SP2-0 fixture, inside the app's theme root (both themes through the header's toggle).
 * The SP1 Vomero template and library carry the same product ids as the fixtures, so the seat card and the product
 * filter read as on the live seed. BFF calls the workspace makes are the harness driver's to answer (page.route).
 */
export function Harness({ fixture }: { fixture: HarnessFixture }) {
  if (fixture === 'supply-risks') {
    return <main data-testid="sp3-harness"><SupplyRisksTable initial={supplyRisksList} nextHref={null} /></main>;
  }
  if (fixture === 'demand-exceptions') {
    return <main data-testid="sp3-harness"><DemandExceptionsTable initial={leonExceptions} nextHref={null} /></main>;
  }
  const detail = fixture === 'multitier' ? multitierDetail : fixture === 'not-traced' ? notTracedDetail : throttledDetail;
  return (
    <SmThemeRoot>
      <Workspace projectName="Spring 2027 (harness)" template={vomeroRunTemplate} library={vomeroProducts} executions={[detail.execution]} initialDetail={detail} />
    </SmThemeRoot>
  );
}
