import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LeadTimeTriplet } from '../lead-time-triplet';

describe('<LeadTimeTriplet>', () => {
  it('renders all three cards with delta chips when all signals present', () => {
    render(
      <LeadTimeTriplet
        published={{ days: 5, observed_at: '2026-05-27T10:00:00Z' }}
        quoted={{ days: 8, observed_at: '2026-05-27T10:00:00Z' }}
        calibrated={{
          window_days: 90,
          percentiles: { p50: 7, p75: 9, p90: 12, p95: 14, p99: 18 },
          sample_count: 200,
        }}
      />,
    );
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Quoted')).toBeInTheDocument();
    expect(screen.getByText('Calibrated p50')).toBeInTheDocument();
    // Quoted is 60% above published → ↑↑ delta chip
    expect(screen.getByText(/\+60%/i)).toBeInTheDocument();
  });

  it('shows "Not shared" when published is null', () => {
    render(
      <LeadTimeTriplet
        published={null}
        quoted={{ days: 8, observed_at: '2026-05-27T10:00:00Z' }}
        calibrated={null}
      />,
    );
    expect(screen.getAllByText(/Not shared/i).length).toBeGreaterThan(0);
  });

  it('handles all-null gracefully — three "Not shared" placeholders', () => {
    render(<LeadTimeTriplet published={null} quoted={null} calibrated={null} />);
    expect(screen.getAllByText(/Not shared/i)).toHaveLength(3);
  });
});
