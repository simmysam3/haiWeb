import { describe, it, expect } from 'vitest';
import { computeSubmitLabel, randomOvernightDefault } from '../audit-wizard';
import { utcToLocal, localToUtc } from '../audit-schedule-picker';

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

describe('randomOvernightDefault', () => {
  it('returns a daily cadence with HH:MM time_of_day', () => {
    const c = randomOvernightDefault();
    expect(c.kind).toBe('daily');
    if (c.kind !== 'daily') return;
    expect(c.time_of_day).toMatch(/^[0-2]\d:[0-5]\d$/);
  });

  it('local hour always in [1..5] and minute always a 10-minute increment in [0..50] across many samples', () => {
    // Property check across 500 samples. The default lives in UTC but the
    // randomness is defined in local-hour space; round-trip through
    // utcToLocal to validate the original intent.
    for (let i = 0; i < 500; i++) {
      const c = randomOvernightDefault();
      if (c.kind !== 'daily') throw new Error('non-daily default');
      const local = utcToLocal(c.time_of_day);
      const [hStr, mStr] = local.split(':');
      const h = Number(hStr);
      const m = Number(mStr);
      expect(h).toBeGreaterThanOrEqual(1);
      expect(h).toBeLessThanOrEqual(5);
      expect(m % 10).toBe(0);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(50);
    }
  });
});

describe('utcToLocal / localToUtc', () => {
  it('round-trips every minute-of-day without loss', () => {
    // Timezone-independent property: (localToUtc ∘ utcToLocal) === identity
    // for all valid HH:MM. The conversion just shifts hours, never minutes,
    // so this holds in every timezone (including half-hour offsets — the
    // hour shift wraps modulo 24, minute is untouched).
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        const utc = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        expect(localToUtc(utcToLocal(utc))).toBe(utc);
      }
    }
  });

  it('returns the input unchanged when the string is not a valid HH:MM', () => {
    expect(utcToLocal('nope')).toBe('nope');
    expect(localToUtc('')).toBe('');
  });
});
