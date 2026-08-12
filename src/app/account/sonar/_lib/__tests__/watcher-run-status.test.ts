import { describe, it, expect } from 'vitest';
// TEST files may value-import the protocol package (client components may not).
import { WatcherRunStatusSchema, type WatcherRunStatus } from '@haiwave/protocol';
import { isTerminal, isUsableRun, STATUS_TRAITS } from '../watcher-run-status';

describe('watcher-run-status traits', () => {
  it('covers every protocol WatcherRunStatus member (exhaustiveness gate)', () => {
    // Named mutation: add a 7th member to WatcherRunStatusSchema without a
    // traits row → the Record fails the BUILD; this test additionally fails
    // at runtime if the schemas drift the other way.
    expect(Object.keys(STATUS_TRAITS).sort()).toEqual(
      [...WatcherRunStatusSchema.options].sort(),
    );
  });
  it('terminal = complete/partial/failed/cancelled', () => {
    expect(isTerminal('complete')).toBe(true);
    expect(isTerminal('partial')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('running')).toBe(false);
    expect(isTerminal('throttled')).toBe(false);
  });
  it('usable = complete/partial only', () => {
    expect(isUsableRun('complete')).toBe(true);
    expect(isUsableRun('partial')).toBe(true);
    for (const s of ['running', 'throttled', 'failed', 'cancelled'] as const) {
      expect(isUsableRun(s)).toBe(false);
    }
  });
  it('failure banner set = terminal AND not usable (failed/cancelled exactly)', () => {
    const bannerSet = WatcherRunStatusSchema.options.filter(
      (s) => isTerminal(s) && !isUsableRun(s),
    );
    expect(bannerSet.sort()).toEqual(['cancelled', 'failed']);
  });
  it('degrades to false (not-terminal, not-usable) on a wire status outside the current union, instead of throwing', () => {
    // Deliberate cast simulating wire data from a newer core (e.g. a 3.65.0/
    // 3.66.0 haiCore serving a 7th WatcherRunStatus member this 3.64.0-symlinked
    // haiWeb build has never heard of) — not sloppy typing.
    const wireSurprise = 'upstream_paused' as unknown as WatcherRunStatus;
    expect(isTerminal(wireSurprise)).toBe(false);
    expect(isUsableRun(wireSurprise)).toBe(false);
  });
});
