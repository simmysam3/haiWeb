/**
 * Re-exports six names @haiwave/protocol already infers and exports
 * (SmWeekDemand, SmCoverageWeek, SmCandidateWeek, SmOptionLimit,
 * SmAvailabilityForm, SmPortfolioResult), and adds the one haiWeb-local
 * alias the protocol doesn't carry, SmPortfolioDrop.
 *
 * SP2 (contract §3): until protocol 3.96.0 reaches the symlink, its additions are typed here as widenings of the
 * 3.95.0 shapes, suffixed `2`. Every 3.95.0 value is assignable to its `2` type (the enums are supersets, the new
 * fields optional), so pages keep handing protocol values down. Task 16 turns each `2` name into an alias of the
 * protocol's own type; nothing else changes then.
 */
export type {
  SmWeekDemand,
  SmCoverageWeek,
  SmCandidateWeek,
  SmOptionLimit,
  SmAvailabilityForm,
  SmPortfolioResult,
} from '@haiwave/protocol';
import type {
  SmCandidateLiveStatus, SmCandidateResult, SmCandidateStatus, SmExecutionStatus, SmExecutionStatusResponse, SmExecutionSummary,
  SmOptionLimit, SmPortfolioResult, SmSlotResult, SourcingMapExecutionResult,
} from '@haiwave/protocol';

export type SmPortfolioDrop = SmPortfolioResult['drops'][number];

/** contract §3: SmExecutionStatusSchema += 'throttled' */
export type SmExecutionStatus2 = SmExecutionStatus | 'throttled';
/** contract §3: SmCandidateLiveStatusSchema += 'waiting' (live only) */
export type SmCandidateLiveStatus2 = SmCandidateLiveStatus | 'waiting';
/** contract §3: SmOptionLimitSchema += 'inputs', 'both' */
export type SmOptionLimit2 = SmOptionLimit | 'inputs' | 'both';
export type SmBand = 'slight' | 'moderate' | 'severe';
export type SmTraceRole = 'binding' | 'inherited';

/** [P-b] a sub-tier node as the seat sees it: alias, tier, country, floored class, band. Never an id, a name or a quantity. */
export interface SmSubtierNode {
  alias: string;
  tier: number;
  country: string | null;
  class: { slug: string; label: string; level: number; of_levels: number } | null;
  band: SmBand | null;
  observed_below: boolean;
}

export interface SmOptionAggregates {
  responders: number;
  median_lead_time_days: number | null;
  utilization: { low: number; moderate: number; high: number; at_capacity: number };
  countries: string[];
  classes: string[];
  not_observed: number;
}

/** [P-c] the trace: parent = candidate_key at tier 1, else an alias. */
export interface SmTrace {
  nodes: Array<{ alias: string; tier: number; role: SmTraceRole; band: SmBand; binds_for: number }>;
  edges: Array<{ parent: string; child: string; band: SmBand }>;
  gaps: Array<{ at: string; status: SmCandidateStatus }>;
}

export interface SmCandidateResult2 extends Omit<SmCandidateResult, 'status' | 'limit'> {
  status: SmCandidateLiveStatus2;
  limit: SmOptionLimit2 | null;
  /** G-4: the planner's key, the card's stable id for anchors and shared_exposure.under */
  candidate_key?: string;
  observed_below?: boolean;
  aggregates?: SmOptionAggregates | null;
  nodes?: SmSubtierNode[];
  trace?: SmTrace | null;
  /** G-46: the shallowest tier with a gap or wall below, filled by SP2-a's composition; null when fully observed */
  unobserved_from_tier?: number | null;
}

export interface SmSlotResult2 extends Omit<SmSlotResult, 'candidates'> {
  candidates: SmCandidateResult2[];
}

export interface SmSharedExposure {
  alias: string;
  tier: number;
  under: string[];
}

export interface SourcingMapExecutionResult2 extends Omit<SourcingMapExecutionResult, 'slots'> {
  slots: SmSlotResult2[];
  shared_exposure?: SmSharedExposure[];
  projection_k?: number | null;
}

/** G-41/G-52: who the execution waits for; the name is null when the waiting responder is below tier 1 (not disclosed). */
export interface SmWaitingOn {
  responder_name: string | null;
  refill_at: string;
}

export interface SmExecutionSummary2 extends Omit<SmExecutionSummary, 'status'> {
  status: SmExecutionStatus2;
  /** G-41: served on the detail and the list, not only the status frame */
  waiting_on?: SmWaitingOn | null;
}

export interface SmExecutionDetail2 {
  execution: SmExecutionSummary2;
  result: SourcingMapExecutionResult2 | null;
}

export interface SmExecutionStatusResponse2 extends Omit<SmExecutionStatusResponse, 'status' | 'changed'> {
  status: SmExecutionStatus2;
  changed: Array<{ slot_index: number; candidate_index: number; candidate: SmCandidateResult2 }>;
  waiting_on?: SmWaitingOn | null;
}
