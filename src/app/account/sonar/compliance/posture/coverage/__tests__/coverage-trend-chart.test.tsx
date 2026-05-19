import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoverageTrendChart } from '../coverage-trend-chart';

const p = (date: string, complete: number) => ({
  snapshot_id: `id-${date}`,
  snapshot_completed_at: `${date}T00:00:00.000Z`,
  coverage_total_products: 100,
  coverage_complete_products: complete,
  coverage_partial_products: 0,
  coverage_no_traversal_products: 100 - complete,
  complete_pct: complete,
  partial_pct: 0,
  no_traversal_pct: 100 - complete,
});

describe('CoverageTrendChart', () => {
  it('shows the onboarding empty-state with fewer than two points', () => {
    render(<CoverageTrendChart points={[p('2026-05-01', 40)]} />);
    expect(screen.getByText(/second compliance snapshot/i)).toBeInTheDocument();
    expect(screen.queryByTestId('coverage-trend-chart')).not.toBeInTheDocument();
  });

  it('renders the chart container with two or more points', () => {
    render(<CoverageTrendChart points={[p('2026-05-01', 40), p('2026-05-08', 70)]} />);
    expect(screen.getByTestId('coverage-trend-chart')).toBeInTheDocument();
    expect(screen.queryByText(/second compliance snapshot/i)).not.toBeInTheDocument();
  });
});
