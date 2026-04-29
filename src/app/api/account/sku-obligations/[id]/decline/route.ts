import { withHaiCore } from '@/lib/with-hai-core';

export const POST = withHaiCore<{ id: string }>(async ({ client, params, request }) => {
  const body = (await request.json().catch(() => ({}))) as { notes?: string };
  return client.declineObligation(params.id, body.notes);
});
