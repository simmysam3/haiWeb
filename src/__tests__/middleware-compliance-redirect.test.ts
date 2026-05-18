import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

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

describe('middleware — v1.34 sonar/audit → sonar/compliance 301 redirects', () => {
  it.each([
    [
      '/account/sonar/audit/dashboard',
      '/account/sonar/compliance/posture/coverage',
    ],
    [
      '/account/sonar/audit/nominations',
      '/account/sonar/compliance/posture/nominations',
    ],
    [
      '/account/sonar/audit/nominations/new',
      '/account/sonar/compliance/posture/nominations/new',
    ],
    [
      '/account/sonar/audit/downstream-gaps',
      '/account/sonar/compliance/posture/obligations',
    ],
    [
      '/account/sonar/audit/runs/abc',
      '/account/sonar/compliance/runs/abc',
    ],
    [
      '/account/sonar/audit/trust-bypass',
      '/account/sonar/compliance/trust-bypass',
    ],
    [
      '/account/sonar/audit/reports/r1/vendor/v1',
      '/account/sonar/compliance/reports/r1/vendor/v1',
    ],
  ])('301s %s → %s', async (from, to) => {
    const res = await run(from);
    expect(res.status).toBe(301);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.origin).toBe('http://localhost:3001');
    expect(loc.pathname).toBe(to);
  });

  // Locks in the EXISTING v1.30 redirect-loop behavior: the `to` callback is
  // fed only `pathname`, so the rebuilt location carries no query string. The
  // v1.34 rules must not regress this — they inherit the same mechanism.
  it('matches existing query-string handling on a redirected path (query dropped)', async () => {
    const res = await run('/account/sonar/audit/runs/abc?x=1');
    expect(res.status).toBe(301);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/account/sonar/compliance/runs/abc');
    expect(loc.searchParams.get('x')).toBeNull();
  });
});
