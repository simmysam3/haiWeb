// src/components/help/__tests__/route-pattern.test.ts
import { describe, it, expect } from 'vitest';
import { toRoutePattern } from '../route-pattern';

describe('toRoutePattern', () => {
  it.each([
    ['/account', '/account'],
    ['/account/', '/account'],
    ['/', '/'],
    ['/account/partners/3f2b8c1e-9d4a-4c7b-8e2f-1a2b3c4d5e6f', '/account/partners/[id]'],
    ['/account/partners/3F2B8C1E-9D4A-4C7B-8E2F-1A2B3C4D5E6F/catalog', '/account/partners/[id]/catalog'],
    ['/account/sonar/audit/42', '/account/sonar/audit/[id]'],
    ['/account/sonar/inquiries/01HZX8Q3W5V2K9M7N4P6R8T0YB', '/account/sonar/inquiries/[id]'],
    ['/account/sonar/inquiries/01hzx8q3w5v2k9m7n4p6r8t0yb', '/account/sonar/inquiries/[id]'],
    ['/account/sonar/posture/changes/chg_9f8e7d6c5b4a3210', '/account/sonar/posture/changes/[id]'],
    ['/sourcing-map/3f2b8c1e-9d4a-4c7b-8e2f-1a2b3c4d5e6f/runs/7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d', '/sourcing-map/[id]/runs/[id]'],
  ])('%s → %s', (input, expected) => {
    expect(toRoutePattern(input)).toBe(expected);
  });

  it('keeps long literal words without digits (they are pages, not ids)', () => {
    expect(toRoutePattern('/account/sonar/grounded-forecasts')).toBe('/account/sonar/grounded-forecasts');
    expect(toRoutePattern('/account/settings/trust-posture')).toBe('/account/settings/trust-posture');
  });

  it('drops any query string or hash', () => {
    expect(toRoutePattern('/account/usage?tab=audit#active-runs')).toBe('/account/usage');
  });

  it('drops a hash that has no query string before it', () => {
    expect(toRoutePattern('/account/usage#active-runs')).toBe('/account/usage');
  });

  it('caps the pattern at 200 characters', () => {
    const long = `/account/${'a'.repeat(300)}`;
    expect(toRoutePattern(long)).toHaveLength(200);
  });

  it('judges a segment by its decoded form, so an id with an encoded hyphen is still an id', () => {
    expect(toRoutePattern('/account/partners/3f2b8c1e%2D9d4a%2D4c7b%2D8e2f%2D1a2b3c4d5e6f')).toBe('/account/partners/[id]');
  });

  it('never throws on a malformed escape: the raw segment is judged and kept', () => {
    expect(toRoutePattern('/account/partners/%E0%A4%A/catalog')).toBe('/account/partners/%E0%A4%A/catalog');
  });
});
