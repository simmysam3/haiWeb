import type { WatcherResult } from '@haiwave/protocol';
import type { EnrichedWatcherResult } from '../counterparties-grid';

// Shared factory for CounterpartiesGrid coverage tests. Extracted (pure move,
// no behavior change) so signal-panel-coverage.test.tsx can build the same
// well-formed WatcherResult shape without duplicating the defaults.
export function makeResult(
  overrides: Partial<WatcherResult> & { counterparty_name?: string | null } = {},
): EnrichedWatcherResult {
  return {
    result_id: crypto.randomUUID(),
    run_id: 'run-1',
    counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    signal_type: 'lead_time_distribution',
    synthesis_mode: 'direct',
    payload: {
      kind: 'direct',
      window_days: 90,
      percentiles: { p50: 5, p75: 7, p90: 12, p95: 15, p99: 22 },
      sample_count: 48,
    },
    gap_reason: null,
    observed_at: '2026-05-27T10:00:00Z',
    tier: 1,
    aggregated_under_tier_1: null,
    external_product_id: null,
    ...overrides,
  } as EnrichedWatcherResult;
}
