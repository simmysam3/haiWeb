import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock `fetchBffJson` so the server component is testable without booting
// Next.js headers/cookies plumbing. Using `vi.hoisted` so the mock factory
// runs before the import of `coverage-header-strip`. The strip now goes
// through the shared `loadCoverage` loader, which itself imports
// `fetchBffJson` from the same module — so the single mock covers both.
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));

vi.mock('@/lib/server-fetch', () => ({
  fetchBffJson,
}));

import { CoverageHeaderStrip } from '../coverage-header-strip';

beforeEach(() => {
  fetchBffJson.mockReset();
  // Pin Date.now so "vs Nd ago" buckets stay deterministic regardless of
  // when the test runs.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function snapshot(complete_pct: number, completed_at = '2026-05-21T00:00:00.000Z') {
  return {
    snapshot_id: '11111111-1111-1111-1111-111111111111',
    snapshot_completed_at: completed_at,
    coverage_total_products: 65,
    coverage_complete_products: 48,
    coverage_partial_products: 12,
    coverage_no_traversal_products: 5,
    complete_pct,
    partial_pct: 18,
    no_traversal_pct: 8,
  };
}

describe('CoverageHeaderStrip (v1.37 R2 + polish item 4 cadence-aware copy)', () => {
  it('renders coverage % + SKU count + cadence-aware trend delta when ≥2 snapshots', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { snapshot: snapshot(73) } })
      .mockResolvedValueOnce({
        kind: 'ok',
        data: {
          // Prior snapshot 6 days before NOW.
          points: [
            snapshot(71, '2026-05-15T12:00:00.000Z'),
            snapshot(73, '2026-05-21T00:00:00.000Z'),
          ],
        },
      });

    render(await CoverageHeaderStrip());

    expect(screen.getByTestId('coverage-header-strip')).toBeInTheDocument();
    expect(screen.getByText('73%')).toBeInTheDocument();
    expect(screen.getByText(/48 of 65 SKUs covered/)).toBeInTheDocument();
    // Delta is latest 73 − prior 71 = +2; prior captured 6d before NOW.
    expect(screen.getByText(/\+2% vs 6d ago/)).toBeInTheDocument();
  });

  it('renders "vs today" when the prior snapshot is < 24h old', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { snapshot: snapshot(73) } })
      .mockResolvedValueOnce({
        kind: 'ok',
        data: {
          points: [
            snapshot(72, '2026-05-21T06:00:00.000Z'),
            snapshot(73, '2026-05-21T11:00:00.000Z'),
          ],
        },
      });

    render(await CoverageHeaderStrip());
    expect(screen.getByText(/\+1% vs today/)).toBeInTheDocument();
  });

  it('omits the delta when only one snapshot exists', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { snapshot: snapshot(60) } })
      .mockResolvedValueOnce({ kind: 'ok', data: { points: [snapshot(60)] } });

    render(await CoverageHeaderStrip());

    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.queryByText(/vs /)).toBeNull();
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
        data: {
          points: [
            snapshot(55, '2026-05-19T12:00:00.000Z'),
            snapshot(50, '2026-05-21T00:00:00.000Z'),
          ],
        },
      });

    render(await CoverageHeaderStrip());

    // Delta is 50 − 55 = -5 → "↘ -5% vs yesterday" (prior was 19th, NOW is 21st 12:00 → 48h+ → "2d ago"). Allow either bucket.
    // 2026-05-19T12:00 to 2026-05-21T12:00 is exactly 48h → just on the boundary; formatter uses `<` strict so 48h hits "2d ago".
    expect(screen.getByText(/↘ -5% vs 2d ago/)).toBeInTheDocument();
  });
});
