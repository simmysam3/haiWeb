import { cookies, headers } from 'next/headers';

export interface ThrottledCounts {
  audit: number;
  type2: number;
  total: number;
}

/**
 * loadThrottledCounts — fetches the current count of throttled runs (audit +
 * type2) from the BFF endpoint. Returns zeros on any network or auth failure so
 * dashboards degrade gracefully.
 *
 * v1.29 Phase 1: extracted from the type2 and phantom-demand dashboard pages.
 */
export async function loadThrottledCounts(): Promise<ThrottledCounts> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;
  try {
    const res = await fetch(`${baseUrl}/api/account/sonar/runs/throttled/count`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return { audit: 0, type2: 0, total: 0 };
    return (await res.json()) as ThrottledCounts;
  } catch {
    return { audit: 0, type2: 0, total: 0 };
  }
}
