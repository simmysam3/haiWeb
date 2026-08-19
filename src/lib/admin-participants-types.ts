/**
 * Local mirror of haiCore's admin participants list payload
 * (apps/core/src/services/admin-dashboard-service.ts, AdminParticipantRow).
 * The admin surface is BFF-only — the shape is service-local in haiCore and
 * mirrored here, same as the dashboard's AdminOverview interface.
 */
export interface AdminParticipantRow {
  participant_id: string;
  legal_name: string;
  status: string;
  business_address_city: string | null;
  business_address_state: string | null;
  business_address_country: string | null;
  registered_at: string | null;
  suspension_reason: string | null;
  agent_count: number;
  trading_pair_count: number;
}

export interface AdminParticipantsList {
  participants: AdminParticipantRow[];
  total_count: number;
}

export function participantLocation(p: AdminParticipantRow): string {
  const cityState = [p.business_address_city, p.business_address_state]
    .filter(Boolean)
    .join(", ");
  return cityState || p.business_address_country || "—";
}
