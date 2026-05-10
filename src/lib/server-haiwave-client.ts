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
 * Returns null if there is no valid session/token (caller can notFound() or
 * redirect to login). The returned client is typed as HaiwaveClient so callers
 * get the full method surface.
 */

import { getSession, getToken } from './auth';
import { createHaiwaveClient, type HaiwaveClient } from './haiwave-api';

export async function getServerHaiwaveClient(): Promise<HaiwaveClient> {
  const [session, token] = await Promise.all([getSession(), getToken()]);

  if (!session || !token) {
    throw new Error('No authenticated session — redirect to login');
  }

  return createHaiwaveClient(token, session.participant.id);
}
