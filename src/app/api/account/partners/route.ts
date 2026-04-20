import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_PARTNERS } from "@/lib/mock-data";

/**
 * GET /api/account/partners
 *
 * Lists active connections (approved + trading_pair) from haiCore.
 * Falls back to mock data when haiCore is unreachable.
 */
export const GET = withHaiCore(
  async ({ client }) => {
    const result = (await client.listActiveConnections()) as unknown as {
      connections: Array<{
        connection_id: string;
        partner_participant_id: string;
        partner_name: string;
        partner_location: string;
        partner_industry: string;
        relationship_state: string;
        invite_yours: boolean;
        invite_theirs: boolean;
        established_at: string;
      }>;
    };

    // Map haiCore response to the shape the UI expects
    return result.connections.map((c) => ({
      id: c.partner_participant_id,
      company_name: c.partner_name,
      status: c.relationship_state,
      manifest_progress: c.relationship_state === "trading_pair" ? 100 : 50,
      established_at: c.established_at,
      location: c.partner_location,
      industry: c.partner_industry,
      invite_yours: c.invite_yours,
      invite_theirs: c.invite_theirs,
      connection_id: c.connection_id,
    }));
  },
  { fallback: MOCK_PARTNERS },
);
