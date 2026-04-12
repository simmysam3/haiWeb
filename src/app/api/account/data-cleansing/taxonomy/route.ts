import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/data-cleansing/taxonomy
 *
 * Lists available concept nodes for the force-assign picker in the
 * review queue panel.
 */
export const GET = withHaiCore(
  async ({ client }) => {
    return client.listConceptNodes();
  },
  { fallback: { nodes: [], total_count: 0 } },
);
