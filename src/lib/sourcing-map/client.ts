import type { SmMethod } from './bff';

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
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: hasBody ? { 'content-type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
    credentials: 'include',
  });
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;
  return { ok: true, status: res.status, data: body as T };
}
