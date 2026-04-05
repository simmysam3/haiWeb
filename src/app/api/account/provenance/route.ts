import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/provenance
 *
 * Returns origin manifests and certifications from haiCore.
 * Falls back to empty arrays on error.
 */
export const GET = withHaiCore(
  async ({ client }) => {
    const [manifests, certifications] = await Promise.all([
      client.getOriginManifests(),
      client.getCertifications(),
    ]);
    return { manifests, certifications };
  },
  { fallback: { manifests: [], certifications: [] } },
);
