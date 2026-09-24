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
    init.headers = { 'content-type': 'application/json' };
    init.body = body;
  }
  return forwardHaiCoreResponse(await client.fetchRaw(`${path}${request.nextUrl.search}`, init));
}
