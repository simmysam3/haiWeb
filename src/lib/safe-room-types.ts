import type { AttributeClass, AttributeClassProposal, InquiryPack as InquiryPackFigures, InquiryPackName, TrustClass } from '@haiwave/protocol';

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
