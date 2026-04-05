import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/orders
 *
 * Returns sell-side orders from haiCore. Falls back to empty list.
 */
export const GET = withHaiCore(
  async ({ client }) => ({ sell_side: await client.getSellSideOrders() }),
  { fallback: { sell_side: [] } },
);
