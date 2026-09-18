import { NextResponse } from 'next/server';

/**
 * Parses a client.fetchRaw() body and returns it as a NextResponse with the same status —
 * the SF-3 idiom of src/app/api/sonar/compliance/requests/obligations/[id]/accept/route.ts:46-50,
 * shared so every v1.101 route doesn't repeat it. The 204 branch (`:46`) is part of the idiom
 * (PF P27): a 204 may carry no body at all, and undici rejects a 204 that does.
 */
export async function forwardHaiCoreResponse(res: { status: number; text(): Promise<string> }): Promise<NextResponse> {
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  const text = await res.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return NextResponse.json(parsed, { status: res.status });
}
