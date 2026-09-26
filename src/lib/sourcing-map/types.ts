/**
 * Types derived from contract §3.6 schemas that the contract does not name.
 * Task 43 re-points this import at @haiwave/protocol; after b-G12 item 3 the
 * protocol exports these names itself, so the file is redundant from then on.
 *
 * Controller ruling F04: contract §10 b-G12 item 4 says nothing is inferred
 * locally — contract.ts already infers and exports SmWeekDemand,
 * SmCoverageWeek, SmCandidateWeek, SmOptionLimit, SmAvailabilityForm and
 * SmPortfolioResult (Task 1). This file re-exports those names rather than
 * re-inferring them, and adds the one haiWeb-local alias, SmPortfolioDrop.
 */
export type {
  SmWeekDemand,
  SmCoverageWeek,
  SmCandidateWeek,
  SmOptionLimit,
  SmAvailabilityForm,
  SmPortfolioResult,
} from '@haiwave/protocol';
import type { SmPortfolioResult } from '@haiwave/protocol';

export type SmPortfolioDrop = SmPortfolioResult['drops'][number];
