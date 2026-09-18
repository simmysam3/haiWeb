import type { AttributeClass, TrustClass } from '@haiwave/protocol';

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
