import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { applyRedirects, middleware } from '../middleware';

// Non-redirect paths fall through to the auth branch; with no session cookies
// they bounce to /login. Stub fetch so the refresh attempt can't make a real
// network call.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 400 })),
  );
});

function run(path: string) {
  return middleware(new NextRequest(`http://localhost:3001${path}`));
}

// v1.34 introduced /audit/* → /compliance/* redirects. v1.37 retargeted
// those destinations to the new IA URLs (/sonar/requests and /sonar/posture)
// so users land directly on the new home in a single 301 hop — no chain
// through the legacy /compliance prefix.
describe('middleware — v1.34 → v1.37 retargeted /sonar/audit/* 301 redirects', () => {
  it.each([
    [
      '/account/sonar/audit/dashboard',
      '/account/sonar/dashboard',
    ],
    // v1.35 carried these directly to Request Management; v1.37 swapped the
    // /compliance/requests target for the new /sonar/requests URL.
    [
      '/account/sonar/audit/nominations',
      '/account/sonar/requests?awaiting=them&type=nomination',
    ],
    [
      '/account/sonar/audit/nominations/new',
      '/account/sonar/requests/new-nomination',
    ],
    [
      '/account/sonar/audit/downstream-gaps',
      '/account/sonar/posture/obligations',
    ],
    [
      '/account/sonar/audit/runs/abc',
      '/account/sonar/posture/runs/abc',
    ],
    [
      '/account/sonar/audit/trust-bypass',
      '/account/sonar/posture/trust-bypass',
    ],
    [
      '/account/sonar/audit/reports/r1/vendor/v1',
      '/account/sonar/reports/r1/vendor/v1',
    ],
  ])('301s %s → %s', async (from, to) => {
    const res = await run(from);
    expect(res.status).toBe(301);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.origin).toBe('http://localhost:3001');
    // Compare pathname+search so entries whose `to` carries a query string
    // (e.g. v1.35 nominations → requests?awaiting=them&type=nomination)
    // are matched against the rebuilt Location verbatim. Entries without
    // a query string compare exactly as before (`search` is '').
    expect(`${loc.pathname}${loc.search}`).toBe(to);
  });

  // Locks in the EXISTING v1.30 redirect-loop behavior: the `to` callback is
  // fed only `pathname`, so the rebuilt location carries no query string. The
  // v1.34 rules must not regress this — they inherit the same mechanism.
  it('matches existing query-string handling on a redirected path (query dropped)', async () => {
    const res = await run('/account/sonar/audit/runs/abc?x=1');
    expect(res.status).toBe(301);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/account/sonar/posture/runs/abc');
    expect(loc.searchParams.get('x')).toBeNull();
  });

  // v1.37: the v1.34/v1.35 chain through /compliance was collapsed — these
  // legacy URLs now resolve in a SINGLE 301 hop to the new IA destination.
  describe('v1.37 chain-collapse: /audit/* lands in one hop', () => {
    it('/account/sonar/audit/nominations → single 301 to /requests?awaiting=them&type=nomination', async () => {
      const res = await run('/account/sonar/audit/nominations');
      expect(res.status).toBe(301);
      const loc = new URL(res.headers.get('location')!);
      expect(`${loc.pathname}${loc.search}`).toBe(
        '/account/sonar/requests?awaiting=them&type=nomination',
      );
      // Critically, the target itself must not match any redirect rule —
      // otherwise we'd be back to a double-301 chain.
      expect(applyRedirects(loc.pathname)).toBeNull();
    });

    it('/account/sonar/audit/nominations/new → single 301 to /requests/new-nomination', async () => {
      const res = await run('/account/sonar/audit/nominations/new');
      expect(res.status).toBe(301);
      const loc = new URL(res.headers.get('location')!);
      expect(loc.pathname).toBe(
        '/account/sonar/requests/new-nomination',
      );
      expect(applyRedirects(loc.pathname)).toBeNull();
    });
  });
});

// v1.37: legacy /compliance/* surfaces redirect to the new split sections.
// These are NextRequest-driven integration tests (the per-rule unit tests
// live in middleware.test.ts); we sample each section's prefix to verify
// the wiring works end-to-end through the response Location header.
describe('middleware — v1.37 /sonar/compliance/* → split sections', () => {
  it.each([
    ['/account/sonar/compliance', '/account/sonar/requests'],
    [
      '/account/sonar/compliance/requests/declined',
      '/account/sonar/requests/declined',
    ],
    [
      '/account/sonar/compliance/evidence/responses/abc',
      '/account/sonar/requests/evidence/responses/abc',
    ],
    [
      '/account/sonar/compliance/posture/coverage',
      '/account/sonar/dashboard',
    ],
    [
      '/account/sonar/compliance/posture/working-list',
      '/account/sonar/posture/working-list',
    ],
    [
      '/account/sonar/compliance/runs/abc',
      '/account/sonar/posture/runs/abc',
    ],
    [
      '/account/sonar/compliance/trust-bypass',
      '/account/sonar/posture/trust-bypass',
    ],
    [
      '/account/sonar/compliance/reports/r-1',
      '/account/sonar/reports/r-1',
    ],
  ])('301s %s → %s in a single hop', async (from, to) => {
    const res = await run(from);
    expect(res.status).toBe(301);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe(to);
    // Single-hop invariant: the destination must not itself redirect.
    expect(applyRedirects(loc.pathname)).toBeNull();
  });
});
