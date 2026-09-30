/**
 * Re-exports the names @haiwave/protocol already infers and exports, and adds the haiWeb-local aliases the protocol
 * doesn't carry, SmPortfolioDrop and SmSharedExposure. The `2` names were SP2's local widenings of 3.95.0 (contract §3)
 * while the symlink lagged; since 3.96.0 they are the protocol's own types under the names the workspace imports.
 */
export type {
  SmWeekDemand,
  SmCoverageWeek,
  SmCandidateWeek,
  SmOptionLimit,
  SmAvailabilityForm,
  SmPortfolioResult,
  SmBand,
  SmTraceRole,
  SmSubtierNode,
  SmOptionAggregates,
  SmTrace,
  SmWaitingOn,
} from '@haiwave/protocol';
import type {
  SmCandidateLiveStatus, SmCandidateResult, SmExecutionDetail, SmExecutionStatus, SmExecutionStatusResponse, SmExecutionSummary,
  SmOptionLimit, SmPortfolioResult, SmSlotResult, SourcingMapExecutionResult,
} from '@haiwave/protocol';

export type SmPortfolioDrop = SmPortfolioResult['drops'][number];

export type SmExecutionStatus2 = SmExecutionStatus;
export type SmCandidateLiveStatus2 = SmCandidateLiveStatus;
export type SmOptionLimit2 = SmOptionLimit;
export type SmCandidateResult2 = SmCandidateResult;
export type SmSlotResult2 = SmSlotResult;
export type SmSharedExposure = NonNullable<SourcingMapExecutionResult['shared_exposure']>[number];
export type SourcingMapExecutionResult2 = SourcingMapExecutionResult;
export type SmExecutionSummary2 = SmExecutionSummary;
export type SmExecutionDetail2 = SmExecutionDetail;
export type SmExecutionStatusResponse2 = SmExecutionStatusResponse;
