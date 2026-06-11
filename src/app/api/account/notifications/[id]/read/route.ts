import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/notifications/[id]/read
 *
 * Marks a notification read. Scoped to the session participant core-side;
 * haiCore returns 404 for an unknown/foreign id (propagated verbatim).
 */
export const POST = withHaiCore<{ id: string }>(({ client, params }) =>
  client.markNotificationRead(params.id),
);
