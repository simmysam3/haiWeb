import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config';

describe('next.config authInterrupts', () => {
  it('enables forbidden() so /sourcing-map can answer 403 (spec §10, AC 1)', () => {
    expect(nextConfig.experimental?.authInterrupts).toBe(true);
  });
});
