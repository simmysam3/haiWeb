import { describe, it, expect } from 'vitest';
import { formatRelativeAge } from '../relative-time';

/**
 * v1.37 polish item 4 — cadence-aware comparator framing for the Posture
 * coverage-header strip. Buckets are deliberately coarse (today /
 * yesterday / Nd / Nmo / Nyr) so the strip stays one row.
 */
describe('formatRelativeAge', () => {
  const NOW = new Date('2026-05-21T12:00:00.000Z').getTime();

  it('returns "today" when the prior snapshot is < 24h old', () => {
    expect(formatRelativeAge('2026-05-21T06:00:00.000Z', NOW)).toBe('today');
    expect(formatRelativeAge('2026-05-20T13:00:00.000Z', NOW)).toBe('today');
  });

  it('returns "yesterday" when the prior snapshot is 24-48h old', () => {
    expect(formatRelativeAge('2026-05-20T06:00:00.000Z', NOW)).toBe('yesterday');
    expect(formatRelativeAge('2026-05-19T13:00:00.000Z', NOW)).toBe('yesterday');
  });

  it('returns "Nd ago" for days within 30', () => {
    expect(formatRelativeAge('2026-05-15T12:00:00.000Z', NOW)).toBe('6d ago');
    expect(formatRelativeAge('2026-05-01T12:00:00.000Z', NOW)).toBe('20d ago');
  });

  it('returns "Nmo ago" once the prior snapshot crosses 30 days', () => {
    // 60 days back ≈ 2mo.
    expect(formatRelativeAge('2026-03-22T12:00:00.000Z', NOW)).toBe('2mo ago');
  });

  it('returns "Nyr ago" once the prior snapshot crosses one year', () => {
    expect(formatRelativeAge('2024-05-21T12:00:00.000Z', NOW)).toBe('2yr ago');
  });

  it('floor-rounds (6d 12h does NOT round up to 7d)', () => {
    // 6 days 12 hours back.
    const sixDaysTwelveHoursAgo = new Date(NOW - (6 * 24 + 12) * 60 * 60 * 1000).toISOString();
    expect(formatRelativeAge(sixDaysTwelveHoursAgo, NOW)).toBe('6d ago');
  });

  it('treats future timestamps as "today" (no negative durations)', () => {
    const future = new Date(NOW + 60 * 60 * 1000).toISOString();
    expect(formatRelativeAge(future, NOW)).toBe('today');
  });

  it('returns "earlier" for an unparseable timestamp', () => {
    expect(formatRelativeAge('not-a-date', NOW)).toBe('earlier');
  });
});
