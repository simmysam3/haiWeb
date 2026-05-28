import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LeadTimePanel } from '../lead-time-panel';

describe('<LeadTimePanel>', () => {
  it('renders direct percentiles when synthesis_mode is direct', () => {
    render(
      <LeadTimePanel
        synthesisMode="direct"
        payload={{
          window_days: 90,
          percentiles: { p50: 5, p75: 7, p90: 12, p95: 15, p99: 22 },
          sample_count: 48,
        }}
      />,
    );
    expect(screen.getByText(/p50/i)).toBeInTheDocument();
    expect(screen.getByText('5d')).toBeInTheDocument();
    expect(screen.getByText(/48 samples/i)).toBeInTheDocument();
  });

  it('renders the aggregated treatment when synthesis_mode is aggregated_derivative', () => {
    render(
      <LeadTimePanel
        synthesisMode="aggregated_derivative"
        payload={{
          median_p50: 6,
          median_p90: 13,
          source_responder_count: 3,
        }}
      />,
    );
    expect(screen.getByText(/median p50/i)).toBeInTheDocument();
    expect(screen.getByText(/3 responders/i)).toBeInTheDocument();
  });

  it('renders the absent treatment when synthesis_mode is redacted_gap', () => {
    render(<LeadTimePanel synthesisMode="redacted_gap" payload={null} />);
    expect(
      screen.getByText(/has not opted into lead-time sharing/i),
    ).toBeInTheDocument();
  });
});
