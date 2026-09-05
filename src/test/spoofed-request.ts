import { expect, type Mock } from 'vitest';

/**
 * Test double for `next/headers` that simulates a request whose Host and
 * X-Forwarded-Proto headers are attacker-controlled. D-62: a server-side BFF
 * fetch must take its origin from the configured PORTAL_BASE_URL, never from
 * these headers, and must never send the caller's cookie to the spoofed host.
 *
 * Usage:
 *   vi.mock('next/headers', async () => (await import('@/test/spoofed-request')).nextHeadersMock);
 */
export const SPOOFED_HOST = 'attacker.example';
export const SESSION_COOKIE = 'haiwave_session=secret-token';

export const nextHeadersMock = {
  cookies: async () => ({ toString: () => SESSION_COOKIE }),
  headers: async () => ({
    get: (name: string): string | null => {
      const n = name.toLowerCase();
      if (n === 'host') return SPOOFED_HOST;
      if (n === 'x-forwarded-proto') return 'https';
      if (n === 'cookie') return SESSION_COOKIE;
      return null;
    },
  }),
};

/** The origin `fetchBffJson` resolves to under the test env (PORTAL_BASE_URL default). */
export const CONFIGURED_ORIGIN = 'http://localhost:3001/';

/** Every fetch the module issued must target the configured origin and none the spoofed host. */
export function expectConfiguredOrigin(fetchMock: Mock): void {
  const urls = fetchMock.mock.calls.map((c) => String(c[0]));
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    expect(url).not.toContain(SPOOFED_HOST);
    expect(url.startsWith(CONFIGURED_ORIGIN), `expected ${url} to start with ${CONFIGURED_ORIGIN}`).toBe(true);
  }
}
