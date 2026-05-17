import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

// The non-redirect paths fall through to the auth branch; with no session
// cookies they 307 to /login. Stub fetch so the refresh attempt can't make a
// real network call.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 400 })),
  );
});

function run(path: string) {
  return middleware(new NextRequest(`http://localhost:3001${path}`));
}

describe('middleware — retired v1.21 PD dashboard redirect', () => {
  it.each([
    '/account/sonar/phantom-demand',
    '/account/sonar/phantom-demand/',
    '/account/sonar/phantom-demand/dashboard',
    '/account/sonar/phantom-demand/dashboard/',
  ])('301s %s → Observations (phantom_demand tab)', async (path) => {
    const res = await run(path);
    expect(res.status).toBe(301);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/account/sonar/observations');
    expect(loc.searchParams.get('tab')).toBe('phantom_demand');
  });

  it.each([
    '/account/sonar/phantom-demand/runs/09be1dc4-3657-4bee-99bd-0afbbeefd92f',
    '/account/sonar/phantom-demand/reports/latest',
    '/account/sonar/phantom-demand/reports/w1/aggregate',
  ])('does NOT redirect the live surface %s to Observations', async (path) => {
    const res = await run(path);
    // Either passes through or (unauthenticated) bounces to /login — but never
    // to the Observations rule.
    const loc = res.headers.get('location');
    if (loc) {
      expect(new URL(loc).pathname).not.toBe('/account/sonar/observations');
    }
    expect(res.status).not.toBe(301);
  });
});
