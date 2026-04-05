import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/source-audit
 *
 * Runs an entity audit. Supports:
 * - vendor_id: direct UUID
 * - vendor_search: partial name match (resolved via participant search)
 * - neither: self-audit (uses session participant ID)
 */
export const POST = withHaiCore(
  async ({ client, session, request }) => {
    const body = await request.json();

    // Resolve vendor ID: direct, by search, or fall back to self
    let resolvedVendorId = body.vendor_id as string | undefined;

    if (!resolvedVendorId && body.vendor_search) {
      try {
        const searchResults = await client.searchParticipants(body.vendor_search, { limit: 1 });
        if (searchResults && searchResults.length > 0) {
          const first = searchResults[0] as Record<string, unknown>;
          resolvedVendorId = (first.id as string) ?? (first.participant_id as string);
        }
      } catch {
        // Fall through to self-audit
      }
    }

    if (!resolvedVendorId) {
      resolvedVendorId = session.participant.id;
    }

    return client.runEntityAudit(
      resolvedVendorId,
      body.product_id,
      body.location_parameter ?? false,
    );
  },
  {
    fallback: {
      audit_id: "mock",
      nodes: [],
      audited_at: new Date().toISOString(),
      _debug: "no_token_or_error",
    },
  },
);
