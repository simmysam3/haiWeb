import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/data-cleansing
 *
 * Lists unclassifiable classification results for the authenticated
 * participant. Used by the Data Cleansing review queue panel.
 */
export const GET = withHaiCore(
  async ({ client, session }) => {
    return client.listClassificationResults(session.participant.id, { status: 'unclassifiable' });
  },
  { fallback: { results: [], total: 0 } },
);
