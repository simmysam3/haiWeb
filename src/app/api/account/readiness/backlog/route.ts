import { withHaiCore } from '@/lib/with-hai-core';
import { BacklogItemStateSchema } from '@haiwave/protocol';
import type { BacklogItemState } from '@haiwave/protocol';

function asBacklogItemState(v: string | null): BacklogItemState | undefined {
  if (v === null) return undefined;
  return BacklogItemStateSchema.safeParse(v).data;
}

export const GET = withHaiCore(({ client, request }) => {
  const url = new URL(request.url);
  return client.listReadinessBacklog({
    skuRef: url.searchParams.get('sku_ref') ?? undefined,
    state: asBacklogItemState(url.searchParams.get('state')),
    demoRunId: url.searchParams.get('demo_run_id') ?? undefined,
  });
});
