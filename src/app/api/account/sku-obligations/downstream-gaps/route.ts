import { withHaiCore } from '@/lib/with-hai-core';
import type { ResolutionClass } from '@haiwave/protocol';
import type { OnNetworkStatus } from '@/app/account/sonar/audit/downstream-gaps/_lib/types';

export const GET = withHaiCore(async ({ client, request }) => {
  const sp = request.nextUrl.searchParams;
  const resolution_class = sp.getAll('resolution_class') as ResolutionClass[];
  const on_network_status = sp.getAll('on_network_status') as OnNetworkStatus[];
  const min_request_count_raw = sp.get('min_request_count');
  const min_request_count = min_request_count_raw !== null
    ? Number.parseInt(min_request_count_raw, 10)
    : undefined;

  return client.getDownstreamGaps({
    resolution_class: resolution_class.length ? resolution_class : undefined,
    on_network_status: on_network_status.length ? on_network_status : undefined,
    min_request_count: Number.isFinite(min_request_count) ? min_request_count : undefined,
  });
});
