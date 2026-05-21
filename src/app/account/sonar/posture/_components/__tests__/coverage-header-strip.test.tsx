import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock `fetchBffJson` so the server component is testable without booting
// Next.js headers/cookies plumbing. Using `vi.hoisted` so the mock factory
// runs before the import of `coverage-header-strip`.
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));

vi.mock('@/lib/server-fetch', () => ({
  fetchBffJson,
}));

import { CoverageHeaderStrip } from '../coverage-header-strip';

beforeEach(() => {
  fetchBffJson.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function snapshot(complete_pct: number) {
  return {
    snapshot_id: '11111111-1111-1111-1111-111111111111',
    snapshot_completed_at: '2026-05-21T00:00:00.000Z',
    coverage_total_products: 65,
    coverage_complete_products: 48,
    coverage_partial_products: 12,
    coverage_no_traversal_products: 5,
    complete_pct,
    partial_pct: 18,
    no_traversal_pct: 8,
  };
}

describe('CoverageHeaderStrip (v1.37 R2)', () => {
  it('renders coverage % + SKU count + trend delta when ≥2 snapshots', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { snapshot: snapshot(73) } })
      .mockResolvedValueOnce({
        kind: 'ok',
        data: { points: [snapshot(71), snapshot(73)] },
      });

    render(await CoverageHeaderStrip());

    expect(screen.getByTestId('coverage-header-strip')).toBeInTheDocument();
    expect(screen.getByText('73%')).toBeInTheDocument();
    expect(screen.getByText(/48 of 65 SKUs covered/)).toBeInTheDocument();
    // Delta is latest 73 − prior 71 = +2.
    expect(screen.getByText(/\+2% vs prior snapshot/)).toBeInTheDocument();
    // Link to the full coverage surface on the Sonar Dashboard.
    const link = screen.getByRole('link', { name: /View full coverage/i });
    expect(link).toHaveAttribute('href', '/account/sonar/dashboard');
  });

  it('omits the delta when only one snapshot exists', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { snapshot: snapshot(60) } })
      .mockResolvedValueOnce({ kind: 'ok', data: { points: [snapshot(60)] } });

    render(await CoverageHeaderStrip());

    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.queryByText(/vs prior snapshot/)).toBeNull();
  });

  it('renders nothing on transport error (silent-fail — Dashboard owns the canonical banner)', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'error', status: 500, message: 'boom' })
      .mockResolvedValueOnce({ kind: 'ok', data: { points: [] } });

    const { container } = render(await CoverageHeaderStrip());
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no snapshot exists (onboarding empty-state — surfaced on Dashboard)', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { snapshot: null } })
      .mockResolvedValueOnce({ kind: 'ok', data: { points: [] } });

    const { container } = render(await CoverageHeaderStrip());
    expect(container.firstChild).toBeNull();
  });

  it('uses the down-arrow + orange colour when delta is negative', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { snapshot: snapshot(50) } })
      .mockResolvedValueOnce({
        kind: 'ok',
        data: { points: [snapshot(55), snapshot(50)] },
      });

    render(await CoverageHeaderStrip());

    // Delta is 50 − 55 = -5 → "↘ -5%".
    expect(screen.getByText(/↘ -5% vs prior snapshot/)).toBeInTheDocument();
  });
});
