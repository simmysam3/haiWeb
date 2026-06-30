import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore(({ client, request }) => {
  const url = new URL(request.url);
  return client.listReadinessBacklog({
    skuRef: url.searchParams.get('sku_ref') ?? undefined,
    state: url.searchParams.get('state') ?? undefined,
    demoRunId: url.searchParams.get('demo_run_id') ?? undefined,
  });
});
