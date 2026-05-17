import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WatcherSignalsCard } from '../watcher-signals-card';

const NO_BANDS = { low: 0, moderate: 0, high: 0, at_capacity: 0 } as const;

describe('WatcherSignalsCard', () => {
  it('shows the empty state only when there is no signal data at all', () => {
    render(
      <WatcherSignalsCard capacityBandCounts={{ ...NO_BANDS }} medianLeadTimeP90={null} />,
    );
    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument();
  });

  it('renders lead-time context when the latest run had only lead_time signals (no capacity bands)', () => {
    render(
      <WatcherSignalsCard capacityBandCounts={{ ...NO_BANDS }} medianLeadTimeP90={6} />,
    );
    // Regression: previously showed "No runs yet" because the empty-state
    // gate counted capacity bands only, hiding a real lead-time p90.
    expect(screen.queryByText(/no runs yet/i)).not.toBeInTheDocument();
    expect(screen.getByText(/6\.0d/)).toBeInTheDocument();
  });

  it('renders capacity bands when present', () => {
    render(
      <WatcherSignalsCard
        capacityBandCounts={{ low: 1, moderate: 2, high: 0, at_capacity: 3 }}
        medianLeadTimeP90={null}
      />,
    );
    expect(screen.queryByText(/no runs yet/i)).not.toBeInTheDocument();
    expect(screen.getByText(/1 low · 2 mod · 0 high · 3 at-cap/)).toBeInTheDocument();
  });
});
