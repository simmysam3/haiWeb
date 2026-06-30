import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore<{ query_id: string }>(
  ({ client, params }) => client.getGoFishResult(params.query_id),
);
