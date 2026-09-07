/**
 * Local mirror of haiCore protocol 3.82.0's counterparty-updates wire shapes
 * (`packages/protocol/src/counterparty-updates.ts`). Field names are kept
 * identical on purpose — do NOT import from `@haiwave/protocol` here; this
 * lane's types are a deliberate local copy (see dispatch-constraints.md).
 */

export type CounterpartySide = 'customer' | 'vendor';
export type CounterpartyUpdateKind = 'identity' | 'attribute' | 'location';
export type CounterpartyUpdateStatus =
  | 'pending'
  | 'approved'
  | 'applied'
  | 'kept'
  | 'converged'
  | 'archived';

/** One ranked ERP row the agent offers for an unlinked counterparty (identity rows). */
export interface CounterpartyUpdateCandidate {
  erp_ref: number;
  erp_id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  score: number;
  matched_on: 'name_exact' | 'name_concat' | 'name';
}

/** One ERP location row a represented plant matched ambiguously (location rows). */
export interface CounterpartyLocationCandidate {
  location_ref: string;
  name: string;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}

export interface CounterpartyUpdateRow {
  id: string;
  counterparty_participant_id: string;
  counterparty_name: string;
  side: CounterpartySide;
  kind: CounterpartyUpdateKind;
  attribute_key: string;
  source: 'profile' | 'locations' | 'library' | 'manifest' | 'erp';
  label: string;
  mine: unknown;
  theirs: unknown;
  theirs_updated_at: string | null;
  // identity rows carry CounterpartyUpdateCandidate; location rows carry
  // CounterpartyLocationCandidate — narrow on 'erp_ref' in candidate.
  candidates?: Array<CounterpartyUpdateCandidate | CounterpartyLocationCandidate>;
  observed_at: string;
  status: CounterpartyUpdateStatus;
  decision: 'take_theirs' | 'keep_mine' | 'link' | null;
  decision_ref: string | null;
  decided_by: string | null;
  decided_at: string | null;
  dirty: boolean;
  applied_at: string | null;
  apply_detail: string | null;
}

export interface WriteCapabilities {
  customer_fields: boolean;
  vendor_fields: boolean;
  customer_ship_to: boolean;
  vendor_purchase_point: boolean;
}

export interface CounterpartySyncState {
  slot_utc: string;
  last_checkin_at: string | null;
  last_run_id: string | null;
  last_run_status: string | null;
  write_capabilities: WriteCapabilities | null;
  agent_version: string | null;
  in_flight_since: string | null;
}

export interface CounterpartyUpdatesList {
  rows: CounterpartyUpdateRow[];
  sync_state: CounterpartySyncState | null;
  counterparties: Array<{ participant_id: string; name: string; pending_count: number }>;
}

/**
 * Mirrors haiCore's `CounterpartyUpdateDecisionSchema`
 * (`packages/protocol/src/counterparty-updates.ts:147-151` on haiCore main) —
 * that schema is the source of truth, not any illustrative wire example.
 */
export type CounterpartyUpdateDecision = { keep: 'mine' | 'theirs' } | { link: number };

export interface SyncNowResponse {
  status: 'started' | 'already_running' | 'no_endpoint' | 'agent_unreachable';
  run_id?: string;
}
