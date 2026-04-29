import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore<{ id: string }>(
  ({ client, params }) => client.getObligation(params.id),
);
