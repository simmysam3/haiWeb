// Local TS mirror of the haiCore registration admin contract (Plan A,
// protocol 3.38.0). haiWeb does not import @haiwave/protocol; the canonical
// source is haiCore packages/protocol/src/registration/. Keep byte-identical
// to that contract — snake_case JSON over the admin API.

export type RiskTier = 'standard' | 'elevated' | 'blocked';
export type RegistrationStatus = 'pending_approval' | 'approved' | 'rejected';

/** Row shape returned by GET /admin/registration-requests. */
export interface RegistrationListItem {
  id: string;
  legal_entity_name: string;
  country_of_origin: string; // ISO 3166-1 alpha-2
  risk_tier: RiskTier;
  status: RegistrationStatus;
  submitted_at: string; // ISO timestamp
}

/**
 * Full detail returned by GET /admin/registration-requests/:id. The applicant
 * PII fields are nullable because they are redacted to null once a request is
 * adjudicated and the tombstone is created (pii_redacted = true).
 */
export interface RegistrationDetail extends RegistrationListItem {
  first_name: string | null;
  last_name: string | null;
  contact_email: string | null;
  role_title: string | null;
  corporate_website: string | null;
  tax_id: string | null;
  duns: string | null;
  hq_street: string | null;
  hq_city: string | null;
  hq_region: string | null;
  hq_postal_code: string | null;
  screening_reason: string;
  source: string;
  adjudicated_by: string | null;
  adjudicated_at: string | null;
  decision_reason: string | null;
  participant_id: string | null;
  pii_redacted: boolean;
  created_at: string;
}

/** POST .../:id/approve response. */
export interface ApproveResponse {
  ok: true;
  participant_id: string;
  status: 'approved';
}

/** POST .../:id/reject response. */
export interface RejectResponse {
  ok: true;
  status: 'rejected';
}

/** 409 body when a blocked-tier request is approved without an override. */
export const BLOCKED_REQUIRES_OVERRIDE = 'blocked_requires_override' as const;
