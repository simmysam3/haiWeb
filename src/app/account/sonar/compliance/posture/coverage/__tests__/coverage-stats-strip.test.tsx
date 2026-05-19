import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoverageStatsStrip } from '../coverage-stats-strip';

const snap = {
  snapshot_id: '11111111-1111-1111-1111-111111111111',
  snapshot_completed_at: '2026-05-12T00:00:00.000Z',
  coverage_total_products: 50,
  coverage_complete_products: 25,
  coverage_partial_products: 15,
  coverage_no_traversal_products: 10,
  complete_pct: 50,
  partial_pct: 30,
  no_traversal_pct: 20,
};

describe('CoverageStatsStrip', () => {
  it('renders the four counts and server percentages', () => {
    render(<CoverageStatsStrip snapshot={snap} />);
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });
});
