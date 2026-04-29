import { describe, it, expect } from 'vitest';
import { formatStatusMix } from '../format-status-mix';

describe('formatStatusMix', () => {
  it('formats single status as "<count> <status>"', () => {
    expect(formatStatusMix({ outstanding: 3 })).toBe('3 outstanding');
  });

  it('orders statuses by canonical lifecycle', () => {
    expect(
      formatStatusMix({ acknowledged: 1, outstanding: 2 }),
    ).toBe('2 outstanding | 1 acknowledged');
  });

  it('omits zero-count statuses', () => {
    expect(
      formatStatusMix({ outstanding: 0, acknowledged: 1 }),
    ).toBe('1 acknowledged');
  });

  it('handles all six statuses in canonical order', () => {
    expect(
      formatStatusMix({
        declined: 1,
        outstanding: 1,
        fully_resolved: 1,
        acknowledged: 1,
        blocked_non_participant: 1,
        partially_resolved: 1,
      }),
    ).toBe(
      '1 outstanding | 1 acknowledged | 1 partially_resolved | 1 fully_resolved | 1 declined | 1 blocked_non_participant',
    );
  });

  it('returns empty string for empty mix', () => {
    expect(formatStatusMix({})).toBe('');
  });
});
