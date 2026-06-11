import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/library/documents
 *
 * Lists the participant's reusable library document artifacts (for the
 * "Existing document" evidence source in the Add Evidence modal). Read-only —
 * gated like the library view GET (session required, no account_admin role).
 * haiCore returns a wrapped envelope {documents: [...]}; the BFF passes it
 * through verbatim. Dev stand-alone mode serves an empty list.
 */
export const GET = withHaiCore(({ client }) => client.listLibraryDocuments(), {
  fallback: { documents: [] },
});
