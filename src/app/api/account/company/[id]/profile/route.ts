import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/company/:id/profile
 *
 * Proxies haiCore's GET /company/:participantId/profile so server components
 * can resolve a vendor's legal_name for page headers/breadcrumbs.
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  return client.getCompanyProfile(params.id);
});
