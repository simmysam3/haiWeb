import { describe, it, expect } from 'vitest';
import { applyRedirects } from './middleware';

describe('v1.35 redirects', () => {
  it('retargets legacy /account/monitoring/audit-nominations to /compliance/requests?awaiting=me&type=nomination', () => {
    expect(applyRedirects('/account/monitoring/audit-nominations')).toBe(
      '/account/sonar/compliance/requests?awaiting=me&type=nomination',
    );
  });

  it('redirects /compliance/posture/nominations to /compliance/requests?awaiting=them&type=nomination', () => {
    expect(
      applyRedirects('/account/sonar/compliance/posture/nominations'),
    ).toBe(
      '/account/sonar/compliance/requests?awaiting=them&type=nomination',
    );
  });

  it('redirects /compliance/posture/nominations/new to /compliance/requests/new-nomination', () => {
    expect(
      applyRedirects('/account/sonar/compliance/posture/nominations/new'),
    ).toBe('/account/sonar/compliance/requests/new-nomination');
  });

  it('returns null for paths with no matching rule', () => {
    expect(applyRedirects('/account/sonar/compliance/requests')).toBeNull();
    expect(applyRedirects('/account/profile')).toBeNull();
  });
});
