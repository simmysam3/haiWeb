import { describe, it, expect } from 'vitest';
import { computeSubmitLabel } from '../audit-wizard';

describe('computeSubmitLabel', () => {
  const manual: { kind: 'manual_only' } = { kind: 'manual_only' };
  const recurring: { kind: 'daily'; time_of_day: string } = {
    kind: 'daily',
    time_of_day: '00:00',
  };

  it('returns "Run now" for manual_only cadence with no source', () => {
    expect(
      computeSubmitLabel({ cadence: manual, isForkMode: false, hasSource: false }),
    ).toBe('Run now');
  });

  it('returns "Run again" for manual_only cadence when source exists', () => {
    expect(
      computeSubmitLabel({ cadence: manual, isForkMode: false, hasSource: true }),
    ).toBe('Run again');
  });

  it('returns "Schedule" for a recurring cadence', () => {
    expect(
      computeSubmitLabel({ cadence: recurring, isForkMode: false, hasSource: false }),
    ).toBe('Schedule');
  });

  it('returns "Create new audit" in fork mode regardless of cadence', () => {
    expect(
      computeSubmitLabel({ cadence: manual, isForkMode: true, hasSource: true }),
    ).toBe('Create new audit');
  });

  it('returns "Create new audit" in fork mode even with recurring cadence', () => {
    expect(
      computeSubmitLabel({ cadence: recurring, isForkMode: true, hasSource: true }),
    ).toBe('Create new audit');
  });
});
