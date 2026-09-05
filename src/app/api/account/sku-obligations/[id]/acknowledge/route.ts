import { withHaiCore } from '@/lib/with-hai-core';

export const POST = withHaiCore<{ id: string }>(
  ({ client, params }) => client.acknowledgeObligation(params.id),
  { role: 'account_admin' },
);
