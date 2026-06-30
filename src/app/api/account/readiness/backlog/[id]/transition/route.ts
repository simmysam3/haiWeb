import { withHaiCore } from '@/lib/with-hai-core';
import type { BacklogItemState } from '@haiwave/protocol';

export const POST = withHaiCore<{ id: string }>(async ({ client, params, request }) => {
  const body = (await request.json()) as { to_state: BacklogItemState; resolution_note?: string };
  return client.transitionReadinessBacklog(params.id, body);
});
