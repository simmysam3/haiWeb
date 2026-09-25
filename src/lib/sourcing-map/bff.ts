import type { NextRequest, NextResponse } from 'next/server';
import type { HaiwaveClient } from '@/lib/haiwave-api';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

export type SmMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Forward a Sourcing Map BFF request to haiCore (`/api/v1` + path, via
 * client.fetchRaw) and relay its status and body — the L7 idiom, shared by
 * every route under /api/account/sourcing-map (contract §6.2). The query
 * string rides along (cursor, class_id, q, disposition, runs).
 */
export async function smForward(
  client: Pick<HaiwaveClient, 'fetchRaw'>,
  request: NextRequest,
  path: string,
  override: { method?: SmMethod; body?: string } = {},
): Promise<NextResponse> {
  const method = override.method ?? (request.method as SmMethod);
  const init: RequestInit = { method };
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const body = override.body ?? (await request.text());
    // Fastify refuses an empty body under a JSON content-type (400), so a
    // bodiless POST goes without one.
    if (body.length > 0) {
      init.headers = { 'content-type': 'application/json' };
      init.body = body;
    }
  }
  return forwardHaiCoreResponse(await client.fetchRaw(`${path}${request.nextUrl.search}`, init));
}

/** Every Sourcing Map id is a uuid: the one test `seg` (BFF) and `smPageId` (pages) share. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A route param bound into a haiCore path. Every Sourcing Map id is a uuid;
 * anything else (notably `..`, which the URL parser would normalise into a
 * different haiCore path) is a 404 before haiCore is called. withHaiCore
 * relays the thrown `status` (src/lib/with-hai-core.ts:137-141).
 */
export function seg(v: string): string {
  if (!UUID.test(v)) throw Object.assign(new Error('Not found'), { status: 404 });
  return v;
}
