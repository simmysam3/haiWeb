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
    // v1.41: Declined collapsed into a direction tab; legacy
    // /compliance/requests/declined now redirects directly to the tab URL
    // in one hop (proxy.ts more-specific rule before the catch-all).
    [
      '/account/sonar/compliance/requests/declined',
      '/account/sonar/requests?direction=declined',
    ],
    [
      '/account/sonar/compliance/requests/new-nomination',
      '/account/sonar/requests/new-nomination',
    ],
    // v1.40: evidence draft/responses retired. The legacy /compliance/evidence
    // rule is retargeted past the (now-redirecting) /requests/evidence URLs
    // straight to the v1.39 Audits section, preserving the single-301-hop
    // invariant. /new → /audit/new; responses (with or without id) → /audit.
    [
      '/account/sonar/compliance/evidence/new',
      '/account/sonar/audit/new',
    ],
    [
      '/account/sonar/compliance/evidence/responses',
      '/account/sonar/audit',
    ],
    [
      '/account/sonar/compliance/evidence/responses/abc-123',
      '/account/sonar/audit',
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
    // v1.40: report detail pages retired. Legacy /compliance/reports/* now
    // collapses straight to the v1.39 Audits surface in a single hop (the
    // old /sonar/reports intermediary is itself a redirect source as of v1.40).
    [
      '/account/sonar/compliance/reports/run-1',
      '/account/sonar/audit/run-1',
    ],
    // vendor sub-path collapses to the run-detail page (no audit vendor page)
    [
      '/account/sonar/compliance/reports/run-1/vendor/v-1',
      '/account/sonar/audit/run-1',
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

// v1.40: three old Sonar surfaces are retired and 301 to the v1.39 Audits
// section. The bare /sonar/reports prefix becomes a redirect source, so two
// pre-existing legacy rules (/audit/reports + /compliance/reports) that used
// to land on /sonar/reports are retargeted to /sonar/audit* directly to keep
// the single-301-hop invariant. All targets must be terminal.
describe('v1.40 Sonar Audit retirements — /reports + /requests/evidence/*', () => {
  it.each([
    // /sonar/reports cluster → /sonar/audit (vendor sub-path collapses to run)
    ['/account/sonar/reports', '/account/sonar/audit'],
    ['/account/sonar/reports/run-1', '/account/sonar/audit/run-1'],
    [
      '/account/sonar/reports/run-1/vendor/v-1',
      '/account/sonar/audit/run-1',
    ],
    // /requests/evidence/* retired → Audits
    ['/account/sonar/requests/evidence/new', '/account/sonar/audit/new'],
    [
      '/account/sonar/requests/evidence/responses',
      '/account/sonar/audit',
    ],
    // response_id→run_id mapping not available; pragmatic fallback to Audits
    [
      '/account/sonar/requests/evidence/responses/resp-1',
      '/account/sonar/audit',
    ],
    // retargeted legacy rules now land on /sonar/audit* in a single hop
    ['/account/sonar/audit/reports', '/account/sonar/audit'],
    ['/account/sonar/audit/reports/run-1', '/account/sonar/audit/run-1'],
    [
      '/account/sonar/audit/reports/run-1/vendor/v-1',
      '/account/sonar/audit/run-1',
    ],
    ['/account/sonar/compliance/reports', '/account/sonar/audit'],
  ])('301s %s → %s in a single hop', (from, to) => {
    expect(applyRedirects(from)).toBe(to);
    const destPath = to.split('?')[0];
    expect(applyRedirects(destPath)).toBeNull();
  });
});

// v1.39 — `/account/sonar/audit` is the LIVE Audits section, not a retired
// surface. The stale v1.34 catch-all (`/audit/* → /posture`) was removed in
// v1.40; the bare /audit URL and its real sub-pages must NOT match any
// redirect rule (a redirect would shadow the live pages AND make the v1.40
// redirect targets non-terminal). The six specific /audit/<subpath> legacy
// rules still fire, but they don't collide with these live URLs.
describe('v1.39 live Audits surface — /audit* URLs are terminal (no redirect)', () => {
  it.each([
    '/account/sonar/audit',
    '/account/sonar/audit/new',
    '/account/sonar/audit/some-run-id',
    '/account/sonar/audit/definitions/some-id',
  ])('%s resolves to null (terminal)', (url) => {
    expect(applyRedirects(url)).toBeNull();
  });
});
