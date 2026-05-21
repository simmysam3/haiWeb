import { headers } from 'next/headers';

/**
 * Discriminated union for server-side BFF fetches.
 *
 * Error variant carries both `status` (HTTP status, or `0` for a network
 * failure / thrown exception) and `message` (server response body or
 * thrown error message). Callers that only care about `status` can
 * ignore `message`; callers that want to surface a reason can read it.
 */
export type FetchResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'error'; status: number; message: string };

/**
 * Server-side fetch with cookie forwarding for BFF route handlers.
 *
 * Usage in a Server Component:
 *   const result = await fetchBffJson<MyResponseType>('/api/sonar/foo');
 *   if (result.kind === 'error') return <ErrorPanel ... />;
 *   return <Page data={result.data} />;
 *
 * - Forwards `cookie` header from the incoming request.
 * - Uses `x-forwarded-proto` + `host` to reconstruct the base URL
 *   (defaults to `http://localhost:3000` if either header is missing).
 * - `cache: 'no-store'` — these are dynamic, per-user surfaces.
 * - Returns a discriminated `FetchResult<T>`. On a non-OK response the
 *   error path includes the HTTP status + response body text. On a
 *   network/throw it returns `{ status: 0, message }`.
 */
export async function fetchBffJson<T>(
  pathAndQuery: string,
): Promise<FetchResult<T>> {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const cookie = h.get('cookie') ?? '';
  const url = `${proto}://${host}${pathAndQuery}`;

  try {
    const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        kind: 'error',
        status: res.status,
        message: text || `Request failed (${res.status})`,
      };
    }
    const data = (await res.json()) as T;
    return { kind: 'ok', data };
  } catch (e) {
    return {
      kind: 'error',
      status: 0,
      message: e instanceof Error ? e.message : 'Network error',
    };
  }
}
