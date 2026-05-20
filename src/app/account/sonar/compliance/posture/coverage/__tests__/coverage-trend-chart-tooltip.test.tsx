import { describe, it, expect } from 'vitest';
import { findNearestPoint } from '../coverage-trend-chart';
import type { CoverageSnapshot } from '../coverage-stats-strip';

const fixture: CoverageSnapshot[] = [
  {
    snapshot_id: 'snap-1',
    snapshot_completed_at: '2026-05-01T12:00:00Z',
    coverage_total_products: 100,
    coverage_complete_products: 40,
    coverage_partial_products: 20,
    coverage_no_traversal_products: 40,
    complete_pct: 40,
    partial_pct: 20,
    no_traversal_pct: 40,
  },
  {
    snapshot_id: 'snap-2',
    snapshot_completed_at: '2026-05-10T12:00:00Z',
    coverage_total_products: 100,
    coverage_complete_products: 55,
    coverage_partial_products: 35,
    coverage_no_traversal_products: 10,
    complete_pct: 55,
    partial_pct: 35,
    no_traversal_pct: 10,
  },
  {
    snapshot_id: 'snap-3',
    snapshot_completed_at: '2026-05-20T12:00:00Z',
    coverage_total_products: 100,
    coverage_complete_products: 70,
    coverage_partial_products: 25,
    coverage_no_traversal_products: 5,
    complete_pct: 70,
    partial_pct: 25,
    no_traversal_pct: 5,
  },
];

describe('findNearestPoint', () => {
  it('returns the closest point when hovering exactly on a date', () => {
    expect(findNearestPoint(fixture, '5/10/2026')).toEqual(fixture[1]);
  });

  it('returns the closer of two neighbors when hovering between dates', () => {
    // Hover near 5/14 — closer to 5/10 than 5/20
    const result = findNearestPoint(fixture, '5/14/2026');
    expect(result).toEqual(fixture[1]);
  });

  it('returns the first point when hovering before the earliest', () => {
    expect(findNearestPoint(fixture, '4/15/2026')).toEqual(fixture[0]);
  });

  it('returns the last point when hovering after the latest', () => {
    expect(findNearestPoint(fixture, '6/15/2026')).toEqual(fixture[2]);
  });
});
