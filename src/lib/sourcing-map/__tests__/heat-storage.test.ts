import { afterEach, describe, expect, it, vi } from 'vitest';
import { SM_HEAT_KEY, readStoredHeat, writeStoredHeat } from '../heat-storage';

describe('heat storage', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads on unless the stored value is exactly off, survives a storage that throws, and writes on | off under sm.heat', () => {
    expect(SM_HEAT_KEY).toBe('sm.heat');
    // no key: on
    expect(readStoredHeat()).toBe(true);
    // exactly 'off': off
    window.localStorage.setItem(SM_HEAT_KEY, 'off');
    expect(readStoredHeat()).toBe(false);
    // anything else: on
    window.localStorage.setItem(SM_HEAT_KEY, 'neon');
    expect(readStoredHeat()).toBe(true);
    // a storage that throws: on
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredHeat()).toBe(true);
    vi.restoreAllMocks();
    // writes
    writeStoredHeat(false);
    expect(window.localStorage.getItem(SM_HEAT_KEY)).toBe('off');
    writeStoredHeat(true);
    expect(window.localStorage.getItem(SM_HEAT_KEY)).toBe('on');
    // a storage that throws on write does not throw
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => writeStoredHeat(false)).not.toThrow();
  });
});
