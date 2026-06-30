import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore(({ client, request }) => {
  const url = new URL(request.url);
  return client.rollupReadiness({
    demoRunId: url.searchParams.get('demo_run_id') ?? undefined,
  });
});
