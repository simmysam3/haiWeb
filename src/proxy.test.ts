import { describe, it, expect } from 'vitest';
import { applyRedirects } from './proxy';

// These tests cover the v1.35 redirect rules (legacy /audit-nominations
// monitoring URL + /compliance/posture/nominations consolidation). v1.37
// retargeted the destinations to the new IA URLs — see the v1.37 block
// further below for the new /compliance/* → /requests|/posture rules.
describe('v1.35 → v1.37 retargeted redirects', () => {
  it('retargets legacy /account/monitoring/audit-nominations to /requests?awaiting=me&type=nomination', () => {
    expect(applyRedirects('/account/monitoring/audit-nominations')).toBe(
      '/account/sonar/requests?awaiting=me&type=nomination',
    );
  });

  it('redirects /compliance/posture/nominations to /requests?awaiting=them&type=nomination', () => {
    expect(
      applyRedirects('/account/sonar/compliance/posture/nominations'),
    ).toBe(
      '/account/sonar/requests?awaiting=them&type=nomination',
    );
  });

  it('redirects /compliance/posture/nominations/new to /requests/new-nomination', () => {
    expect(
      applyRedirects('/account/sonar/compliance/posture/nominations/new'),
    ).toBe('/account/sonar/requests/new-nomination');
  });

  it('returns null for paths with no matching rule', () => {
    // v1.37 — /sonar/requests is the new canonical Request Management URL
    // and must not match any redirect rule (would be a self-loop).
    expect(applyRedirects('/account/sonar/requests')).toBeNull();
    expect(applyRedirects('/account/profile')).toBeNull();
  });
});

// v1.37 followup #1: the /audit/nominations rule's inner /new check is
// anchored to the SUFFIX (the segment after /audit/nominations), not the
// full pathname. Prevents a nested /…/foo/new from spuriously routing to
// the new-nomination form.
describe('v1.37 followup — /audit/nominations /new check is suffix-anchored', () => {
  it('exact /audit/nominations/new still 301s to /requests/new-nomination', () => {
    expect(applyRedirects('/account/sonar/audit/nominations/new')).toBe(
      '/account/sonar/requests/new-nomination',
    );
  });

  it('/audit/nominations/new/anything 301s to /requests/new-nomination', () => {
    expect(
      applyRedirects('/account/sonar/audit/nominations/new/extra'),
    ).toBe('/account/sonar/requests/new-nomination');
  });

  it('nested non-new path with a /new tail does NOT route to new-nomination', () => {
    // The previous full-pathname check would have falsely matched here.
    // The suffix-anchored check sends it to the default outbound queue.
    expect(
      applyRedirects('/account/sonar/audit/nominations/foo/new'),
    ).toBe('/account/sonar/requests?awaiting=them&type=nomination');
  });

  it('bare /audit/nominations still 301s to the outbound queue', () => {
    expect(applyRedirects('/account/sonar/audit/nominations')).toBe(
      '/account/sonar/requests?awaiting=them&type=nomination',
    );
  });
});

// v1.37 IA split: every legacy /account/sonar/compliance/* path 301s to its
// new Request Management or Posture home. The aim is a single 301 hop — no
// rule's destination may itself match a redirect (verified inline below).
describe('v1.37 redirects — /sonar/compliance/* → split sections', () => {
  it.each([
    // bare hub → Request Management active queue
    ['/account/sonar/compliance', '/account/sonar/requests'],
    // requests sub-paths preserve their tail
    [
      '/account/sonar/compliance/requests',
      '/account/sonar/requests',
    ],
    [
      '/account/sonar/compliance/requests/declined',
      '/account/sonar/requests/declined',
    ],
    [
      '/account/sonar/compliance/requests/new-nomination',
      '/account/sonar/requests/new-nomination',
    ],
    // evidence draft/responses moved under Request Management
    [
      '/account/sonar/compliance/evidence/new',
      '/account/sonar/requests/evidence/new',
    ],
    [
      '/account/sonar/compliance/evidence/responses',
      '/account/sonar/requests/evidence/responses',
    ],
    [
      '/account/sonar/compliance/evidence/responses/abc-123',
      '/account/sonar/requests/evidence/responses/abc-123',
    ],
    // v1.37 R2 — posture/coverage moved to /sonar/dashboard (coverage left
    // the Posture section in the second v1.37 restructure)
    [
      '/account/sonar/compliance/posture/coverage',
      '/account/sonar/dashboard',
    ],
    // v1.37 R2 — direct R1-era /sonar/posture/coverage bookmarks also land
    // on /sonar/dashboard in a single hop
    [
      '/account/sonar/posture/coverage',
      '/account/sonar/dashboard',
    ],
    // other posture surfaces keep their tail
    [
      '/account/sonar/compliance/posture/working-list',
      '/account/sonar/posture/working-list',
    ],
    [
      '/account/sonar/compliance/posture/changes',
      '/account/sonar/posture/changes',
    ],
    [
      '/account/sonar/compliance/posture/changes/c-1',
      '/account/sonar/posture/changes/c-1',
    ],
    [
      '/account/sonar/compliance/posture/obligations',
      '/account/sonar/posture/obligations',
    ],
    // runs moved under posture; trust-bypass moved under posture
    [
      '/account/sonar/compliance/runs',
      '/account/sonar/posture/runs',
    ],
    [
      '/account/sonar/compliance/runs/run-abc',
      '/account/sonar/posture/runs/run-abc',
    ],
    [
      '/account/sonar/compliance/trust-bypass',
      '/account/sonar/posture/trust-bypass',
    ],
    // report detail pages moved up to top-level /reports
    [
      '/account/sonar/compliance/reports/run-1',
      '/account/sonar/reports/run-1',
    ],
    [
      '/account/sonar/compliance/reports/run-1/vendor/v-1',
      '/account/sonar/reports/run-1/vendor/v-1',
    ],
  ])('301s %s → %s and target is terminal (no chain)', (from, to) => {
    expect(applyRedirects(from)).toBe(to);
    // Critical invariant: the destination must NOT itself match a redirect.
    // Strip any query string before re-checking (applyRedirects only sees
    // the pathname; queries are appended literally to the rewrite target).
    const destPath = to.split('?')[0];
    expect(applyRedirects(destPath)).toBeNull();
  });
});
