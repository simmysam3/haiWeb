import { cookies, headers } from 'next/headers';

export interface ThrottledCounts {
  audit: number;
  watcher: number;
  total: number;
}

/**
 * loadThrottledCounts — fetches the current count of throttled runs (audit +
 * watcher) from the BFF endpoint. Returns null on network or auth failure so the
 * caller can render a degraded-state indicator. The previous behavior returned
 * zeros, which caused the throttled-runs panel to disappear entirely on
 * failure — operators saw a clean dashboard while runs were actually waiting.
 * That inverts the v1.29 Phase 1 visibility goal. The new contract:
 *
 *   - 200 OK with body  → ThrottledCounts (zeros mean "nothing throttled")
 *   - any other outcome → null            ("count unavailable")
 *
 * v1.29 Phase 1: extracted from the watcher and phantom-demand dashboard pages.
 */
export async function loadThrottledCounts(): Promise<ThrottledCounts | null> {
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
    if (!res.ok) {
      console.error('[loadThrottledCounts] non-OK response', { status: res.status });
      return null;
    }
    return (await res.json()) as ThrottledCounts;
  } catch (err) {
    console.error('[loadThrottledCounts] fetch threw', { err });
    return null;
  }
}
