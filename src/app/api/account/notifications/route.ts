import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/notifications
 *
 * Lists the participant's in-app notifications. `?unread=true` restricts to
 * unread; absent or any other value lists all. Read-only.
 */
export const GET = withHaiCore(({ client, request }) =>
  client.listNotifications(request.nextUrl.searchParams.get("unread") === "true"),
);
