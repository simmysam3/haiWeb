import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import { CAUSE_PILLS, backlogQuery, loadErrorText, nextHref } from '@/lib/sourcing-map/backlogs';
import { EM_DASH } from '@/lib/sourcing-map/map/selectors';
import type { SmDemandExceptionListResponse } from '@/lib/sourcing-map/types';
import { resolveKindFilter } from '../_lib/resolve-kind-filter';
import { BacklogPills } from '../_components/backlog-pills';
import { DemandExceptionsTable } from './_components/demand-exceptions-table';

const PATHNAME = '/account/sonar/demand-exceptions';
const STANDING_LINE = `Planning probes ${EM_DASH} answers are not commitments.`;

export default async function DemandExceptionsPage({ searchParams }: {
  searchParams: Promise<{ cause?: string | string[]; cursor?: string }>;
}) {
  const sp = await searchParams;
  // Fail closed: an empty or unknown `cause` means all three, never "no filter" and never none.
  const causes = resolveKindFilter(sp.cause, CAUSE_PILLS.map((p) => p.value));
  const query = backlogQuery('cause', causes, sp.cursor);
  const result = await fetchBffJson<SmDemandExceptionListResponse>(`/api/account/sourcing-map/demand-exceptions?${query}`);

  return (
    <div>
      <PageHeader title="Demand Exceptions" />
      <p className="mb-3 text-sm text-slate">{STANDING_LINE}</p>
      <BacklogPills param="cause" pills={CAUSE_PILLS} active={causes} />
      {result.kind === 'error' ? (
        <p role="alert" className="text-red-900">{loadErrorText(result.status, 'demand exceptions')}</p>
      ) : (
        <DemandExceptionsTable
          key={query}
          initial={result.data}
          nextHref={nextHref(PATHNAME, 'cause', causes, result.data.next_cursor)}
        />
      )}
    </div>
  );
}
