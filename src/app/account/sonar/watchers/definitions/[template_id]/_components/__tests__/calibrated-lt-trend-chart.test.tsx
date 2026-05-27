import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalibratedLTTrendChart } from '../calibrated-lt-trend-chart';

describe('<CalibratedLTTrendChart>', () => {
  it('renders an SVG with one polyline per counterparty', () => {
    const runs = [
      {
        run_id: 'r1',
        triggered_at: '2026-05-01T10:00:00Z',
        results: [
          {
            counterparty_participant_id: 'cp-A',
            signal_type: 'lead_time_distribution',
            synthesis_mode: 'direct',
            payload: { percentiles: { p50: 5 }, window_days: 90, sample_count: 10 },
          },
        ],
      },
      {
        run_id: 'r2',
        triggered_at: '2026-05-15T10:00:00Z',
        results: [
          {
            counterparty_participant_id: 'cp-A',
            signal_type: 'lead_time_distribution',
            synthesis_mode: 'direct',
            payload: { percentiles: { p50: 6 }, window_days: 90, sample_count: 12 },
          },
        ],
      },
    ];
    const { container } = render(<CalibratedLTTrendChart runs={runs as never} />);
    expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0);
  });

  it('renders the fallback when no run has LT results', () => {
    render(<CalibratedLTTrendChart runs={[]} />);
    expect(
      screen.getByText(/Trend view unavailable/i),
    ).toBeInTheDocument();
  });
});
