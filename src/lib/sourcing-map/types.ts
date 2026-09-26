/**
 * Re-exports six names @haiwave/protocol already infers and exports
 * (SmWeekDemand, SmCoverageWeek, SmCandidateWeek, SmOptionLimit,
 * SmAvailabilityForm, SmPortfolioResult), and adds the one haiWeb-local
 * alias the protocol doesn't carry, SmPortfolioDrop.
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
