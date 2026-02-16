import { getToken, getSession } from "./auth";
import { createHaiwaveClient } from "./haiwave-api";

/**
 * Server-side data fetching utility.
 * Reads token + session from cookies, calls haiCore with auth headers.
 * Returns fallback on any error (allows app to work without running backends).
 */
export async function fetchFromApi<T>(
  fn: (client: ReturnType<typeof createHaiwaveClient>) => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    const token = await getToken();
    const session = await getSession();
    if (!token || !session || !token.includes(".")) return fallback;

    const client = createHaiwaveClient(token, session.participant.id);
    return await fn(client) as T;
  } catch {
    return fallback;
  }
}
