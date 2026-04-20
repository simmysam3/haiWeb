import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/provenance
 *
 * Returns origin manifests and certifications from haiCore.
 * Falls back to empty arrays on error.
 */
export const GET = withHaiCore(
  async ({ client }) => {
    const [manifestsEnvelope, certificationsEnvelope] = await Promise.all([
      client.getOriginManifests() as Promise<{ manifests?: unknown[] }>,
      client.getCertifications() as Promise<{ certifications?: unknown[] }>,
    ]);
    return {
      manifests: manifestsEnvelope.manifests ?? [],
      certifications: certificationsEnvelope.certifications ?? [],
    };
  },
  { fallback: { manifests: [], certifications: [] } },
);
