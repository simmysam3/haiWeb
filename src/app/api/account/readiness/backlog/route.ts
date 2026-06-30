import { withHaiCore } from '@/lib/with-hai-core';
import type { BacklogItemState } from '@haiwave/protocol';

const BACKLOG_ITEM_STATES: ReadonlySet<string> = new Set<BacklogItemState>([
  'open', 'acknowledged', 'resolved', 'dismissed',
]);

function asBacklogItemState(v: string | null): BacklogItemState | undefined {
  if (v !== null && BACKLOG_ITEM_STATES.has(v)) return v as BacklogItemState;
  return undefined;
}

export const GET = withHaiCore(({ client, request }) => {
  const url = new URL(request.url);
  return client.listReadinessBacklog({
    skuRef: url.searchParams.get('sku_ref') ?? undefined,
    state: asBacklogItemState(url.searchParams.get('state')),
    demoRunId: url.searchParams.get('demo_run_id') ?? undefined,
  });
});
