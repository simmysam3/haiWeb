import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { WatcherResult } from '@haiwave/protocol';
import { CalibratedLTTrendChart, type TrendRun } from '../calibrated-lt-trend-chart';

/** A real WatcherResult row (the wire shape the trailing-history lane returns). */
function ltResult(runId: string, p50: number): WatcherResult {
  return {
    result_id: `res-${runId}`,
    run_id: runId,
    counterparty_participant_id: 'cp-A',
    signal_type: 'lead_time_distribution',
    synthesis_mode: 'direct',
    payload: { percentiles: { p50 }, window_days: 90, sample_count: 10 } as WatcherResult['payload'],
    gap_reason: null,
    observed_at: '2026-05-01T10:00:00Z',
    tier: 1,
    aggregated_under_tier_1: null,
    external_product_id: null,
  };
}

describe('<CalibratedLTTrendChart>', () => {
  it('renders an SVG with one polyline per counterparty', () => {
    const runs: TrendRun[] = [
      { run_id: 'r1', triggered_at: '2026-05-01T10:00:00Z', results: [ltResult('r1', 5)] },
      { run_id: 'r2', triggered_at: '2026-05-15T10:00:00Z', results: [ltResult('r2', 6)] },
    ];
    const { container } = render(<CalibratedLTTrendChart runs={runs} />);
    expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0);
  });

  it('renders the fallback when no run has LT results', () => {
    render(<CalibratedLTTrendChart runs={[]} />);
    expect(
      screen.getByText(/Trend view unavailable/i),
    ).toBeInTheDocument();
  });

  // Pin: a lane that did not answer is not "no results".
  it('says the trend data could not be loaded, not "no results", when runs is null', () => {
    render(<CalibratedLTTrendChart runs={null} />);
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/Trend view unavailable/i)).not.toBeInTheDocument();
  });
});
