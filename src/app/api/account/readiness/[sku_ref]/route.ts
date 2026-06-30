import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore<{ sku_ref: string }>(
  ({ client, params, request }) => {
    const url = new URL(request.url);
    const runQty = url.searchParams.get('run_qty');
    const demoRunId = url.searchParams.get('demo_run_id') ?? undefined;
    return client.getColorwayReadiness(params.sku_ref, {
      runQty: runQty !== null ? parseInt(runQty, 10) : undefined,
      demoRunId,
    });
  },
);
