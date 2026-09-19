import type { AttributeClass, AttributeClassProposal, InquiryOutcome, InquiryOutcomeOrPending, InquiryPack as InquiryPackFigures, InquiryPackName, TrustClass } from '@haiwave/protocol';

// ─── Disclosure policy (spec §5; as-built apps/core/src/routes/disclosure-policy.ts at 16b31655) ───
export type Disclosure = 'raw' | 'qualified' | 'declined';

/** One matrix cell: (attribute class × trust class). PF P3, PF P5. */
export interface DisclosurePolicyRow {
  attribute_class_id: string;
  trust_class: TrustClass;
  disclosure: Disclosure;
  disclose_shortfall_quantity: boolean;
  source: 'registry' | 'participant';
}

/** GET /disclosure-policy — one key (PF P3). */
export interface DisclosurePolicyResponse {
  matrix: DisclosurePolicyRow[];
}

/** One per-counterparty override — keyed (counterparty × attribute class), never on a trust class (PF P6). */
export interface DisclosurePolicyOverrideRow {
  counterparty_participant_id: string;
  attribute_class_id: string;
  disclosure: Disclosure;
  disclose_shortfall_quantity: boolean | null;
}

/** GET /disclosure-policy/overrides (PF P24). */
export interface DisclosurePolicyOverridesResponse {
  overrides: DisclosurePolicyOverrideRow[];
}

/** GET /room-participation — an object, not an array (PF P4). */
export interface RoomParticipationState {
  global: boolean;
  per_class: Record<string, boolean>;
}

/** PUT /room-participation body — the element shape the write still takes (measured MATCH). */
export interface RoomParticipationSetting {
  attribute_class_id: string | null; // null = the global setting
  enabled: boolean;
}

// ─── Attribute-class registry (spec §4.1–4.3) ───
/**
 * Read-only display subset of the protocol's own `AttributeClass` (PF P7), derived with `Pick`
 * so a protocol change is a build error rather than a silent drift. NEVER use it for a write:
 * a proposal body must satisfy `AttributeClassProposalSchema` in full — see Task 11 (PF P8).
 */
export type AttributeClassSummary = Pick<AttributeClass, 'attribute_class_id' | 'display_name' | 'status' | 'default_disclosure'>;

/** GET /attribute-classes (PF P7). */
export interface AttributeClassListResponse {
  attribute_classes: AttributeClassSummary[];
}

// ─── Inquiry-door configuration packs (spec §10.6) ───
// PF P11/PF P12: both types come from the protocol. `InquiryPack` there is the FIGURES object,
// so it is aliased; the three pack names are `InquiryPackName`. Merged into the file's single
// `@haiwave/protocol` import line rather than adding a second one (import/no-duplicates).
export type { InquiryPackFigures, InquiryPackName };

export interface InquiryPackConfig {
  pack: InquiryPackName;
  figures: InquiryPackFigures;
  ceiling: {
    limit_per_hour: number;
    source: 'participant_override' | 'platform_default';
  };
}

// ─── Registry proposals (spec §4.3) ───
// PF P9: this is haiCore's ROUTE-LAYER type `AttributeClassProposalWire`
// (apps/core/src/lib/attribute-class-proposal-wire.ts:14-25). The protocol does NOT export it, so
// it is declared here verbatim; only the nested proposed shape is a protocol type.
export interface AttributeClassProposalRow {
  id: string;
  proposer_participant_id: string;
  attribute_class_id: string;
  proposed_shape: AttributeClassProposal;
  status: 'pending' | 'adopted' | 'rejected';
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  adopted_attribute_class_id: string | null;
  created_at: string;
}

/** GET /attribute-classes/proposals (PF P9). */
export interface AttributeClassProposalListResponse {
  proposals: AttributeClassProposalRow[];
}

// ─── Qualified inquiries (spec §6.4, §11; as-built at 16b31655) ───
// Item 4 (final fix wave): the protocol exports this exact five-member union
// (packages/protocol/src/inquiry/verdict.ts:10) — importing it makes a sixth outcome a build
// error instead of silent drift, the same reasoning as AttributeClassSummary above (PF P7).
export type { InquiryOutcome };
export type InquiryDirection = 'inbound' | 'outbound';

export interface InquiryLogRow {
  inquiry_id: string;
  requester_participant_id: string;
  responder_participant_id: string;
  subjects: unknown[]; // spec §6.1 discriminated union (sku/product_class/component_ref/facility/participant); not further typed here
  attribute_class_id: string;
  tier_at_request: TrustClass;
  /** The row's lifecycle status — distinct from `outcome`, and narrowed to the as-built five (PF P20). */
  status: 'dispatched' | 'pending' | 'answered' | 'declined' | 'unavailable';
  /** null on a dispatched or pending row (PF P20). */
  outcome: InquiryOutcome | null;
  commitment_id: string | null;
  /**
   * A 0/1 INDICATOR, not a count: no table links a guard trip to an inquiry, and the room stores
   * one rule type, so it can never exceed 1. It is 0 on every outbound row by construction, which
   * is why only the inbound view renders it (PF P21).
   */
  guard_trip_count: number;
  created_at: string;
}

/** PF P15 / ruling Q3: the one console state when haiCore refuses the inquiry scope. */
export const INQUIRY_NOT_ENABLED_MESSAGE = 'Inquiry log is not enabled for this console';
export interface InquiryNotEnabled {
  not_enabled: true;
}

export interface InquiryListResponse {
  rows: InquiryLogRow[];
  next_cursor: string | null;
  /** Set by the BFF only, when the upstream refused with 403 (PF P15). */
  not_enabled?: true;
}

/**
 * The detail body. The verdict union and its pending member are L0's — imported, never
 * re-declared (PF P16, PF P18), which is also how `unit` survives on the answered member (PF P19).
 */
export type InquiryDetailResponse = InquiryOutcomeOrPending | InquiryNotEnabled;
