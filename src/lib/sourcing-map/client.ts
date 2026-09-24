import type { SmMethod } from './bff';
import { describeApiError } from '@/lib/api-error';

export type SmResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; message: string; body: unknown };

/**
 * Client-side call to a Sourcing Map BFF route. The body is always a JSON
 * string: uploaded files never leave the browser (spec §5.2, §7.3), only
 * the mapped rows the caller passes here.
 */
export async function smFetch<T>(path: string, init: { method?: SmMethod; body?: unknown } = {}): Promise<SmResult<T>> {
  const hasBody = init.body !== undefined;
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: hasBody ? { 'content-type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(init.body) : undefined,
      credentials: 'include',
    });
  } catch {
    return { ok: false, status: 0, message: 'The request did not reach the server. Check your connection and try again.', body: null };
  }
  if (res.status === 204) return { ok: true, status: 204, data: null as T };
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (res.ok) return { ok: true, status: res.status, data: body as T };
  // The console's one error-sentence helper (src/lib/api-error.ts:49-94); it reads a Response,
  // so it gets one rebuilt from the text already read.
  const { message } = await describeApiError(new Response(text || null, { status: res.status }));
  return { ok: false, status: res.status, message, body };
}
