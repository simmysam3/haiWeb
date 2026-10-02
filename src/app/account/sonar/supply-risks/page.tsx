import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import { ACTIVE_RISK_STATUSES, RISK_STATUS_PILLS, backlogQuery, loadErrorText, nextHref } from '@/lib/sourcing-map/backlogs';
import type { SmSupplyRiskListResponse } from '@/lib/sourcing-map/types';
import { resolveKindFilter } from '../_lib/resolve-kind-filter';
import { BacklogPills } from '../_components/backlog-pills';
import { SupplyRisksTable } from './_components/supply-risks-table';

const PATHNAME = '/account/sonar/supply-risks';

export default async function SupplyRisksPage({ searchParams }: {
  searchParams: Promise<{ status?: string | string[]; cursor?: string }>;
}) {
  const sp = await searchParams;
  // Fail closed (G-15): an empty or unknown `status` means the active statuses, never "no filter".
  const statuses = resolveKindFilter(sp.status, RISK_STATUS_PILLS.map((p) => p.value), ACTIVE_RISK_STATUSES);
  const query = backlogQuery('status', statuses, sp.cursor);
  const result = await fetchBffJson<SmSupplyRiskListResponse>(`/api/account/sourcing-map/supply-risks?${query}`);

  return (
    <div>
      <PageHeader title="Supply Risks" />
      <BacklogPills param="status" pills={RISK_STATUS_PILLS} active={statuses} />
      {result.kind === 'error' ? (
        <p role="alert" className="text-red-900">{loadErrorText(result.status, 'supply risks')}</p>
      ) : (
        <SupplyRisksTable
          key={query}
          initial={result.data}
          nextHref={nextHref(PATHNAME, 'status', statuses, result.data.next_cursor)}
        />
      )}
    </div>
  );
}
