import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NearestDotTooltip } from '../coverage-trend-chart';

const point = {
  snapshot_completed_at: '2026-05-10T12:00:00Z',
  complete_pct: 55,
  partial_pct: 35,
  no_traversal_pct: 10,
};

describe('NearestDotTooltip', () => {
  it('renders null when inactive', () => {
    const { container } = render(<NearestDotTooltip active={false} payload={[{ payload: point }]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when payload is empty', () => {
    const { container } = render(<NearestDotTooltip active payload={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when payload is missing snapshot_completed_at', () => {
    const { container } = render(<NearestDotTooltip active payload={[{ payload: { complete_pct: 1 } }]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all three percentage values from the hovered point', () => {
    render(<NearestDotTooltip active payload={[{ payload: point }]} />);
    expect(screen.getByText(/Complete: 55%/)).toBeInTheDocument();
    expect(screen.getByText(/Partial: 35%/)).toBeInTheDocument();
    expect(screen.getByText(/No traversal: 10%/)).toBeInTheDocument();
  });

  it('renders a formatted date label from snapshot_completed_at (locale-safe — no string round-trip)', () => {
    render(<NearestDotTooltip active payload={[{ payload: point }]} />);
    // Don't assert exact locale format; assert the date renders SOMEWHERE in the tooltip body.
    // The component uses new Date(ISO).toLocaleDateString() — output varies by CI locale.
    const expected = new Date(point.snapshot_completed_at).toLocaleDateString();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
