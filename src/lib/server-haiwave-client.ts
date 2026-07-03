/**
 * Server-component haiCore client.
 *
 * Usage (RSC only — NOT in client components or BFF route handlers):
 *
 *   const client = await getServerHaiwaveClient();
 *   const run = await client.getPhantomDemandRun(id);
 *
 * BFF route handlers should use `withHaiCore` instead (they have full request
 * context). This helper is for React Server Components that need direct haiCore
 * access without going through an additional BFF round-trip.
 *
 * Throws if there is no valid session/token (caller lets the route's error
 * boundary handle it, or wraps the call in try/catch to redirect to login).
 * For a soft fallback instead of a throw, use `fetchFromApi` below.
 */

import { getSession, getToken } from './auth';
import { createHaiwaveClient, type HaiwaveClient } from './haiwave-api';

export async function getServerHaiwaveClient(): Promise<HaiwaveClient> {
  const [session, token] = await Promise.all([getSession(), getToken()]);

  // A non-JWT token is the dev stand-alone cookie; it cannot authenticate a
  // real haiCore call, so treat it the same as a missing session.
  if (!session || !token || !token.includes('.')) {
    throw new Error('No authenticated session — redirect to login');
  }

  return createHaiwaveClient(token, session.participant.id);
}

/**
 * Soft variant for Server Components that prefer degraded content over an error
 * boundary: runs `fn` against the server client and returns `fallback` if there
 * is no session/token or the call fails. Prefer `getServerHaiwaveClient` when a
 * failure should surface.
 */
export async function fetchFromApi<T>(
  fn: (client: HaiwaveClient) => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn(await getServerHaiwaveClient());
  } catch {
    return fallback;
  }
}
