// src/app/api/help/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { helpAuth, helpUpstream, relayJson } from '@/lib/help/help-upstream';

export const runtime = 'nodejs';

// 16,000 characters of 3-byte UTF-8 (Korean) is 48 KB; 70 KB leaves room for JSON
// escaping. haiCore enforces the exact limits (contract C.2); this only stops the
// BFF relaying arbitrarily large bodies.
const MAX_BODY_BYTES = 70_000;

export async function POST(request: NextRequest) {
  const auth = await helpAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.text();
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Message too large' }, { status: 413 });
  }

  let upstream: Response;
  try {
    upstream = await helpUpstream(auth, '/help/messages', { method: 'POST', body, signal: request.signal, served: true });
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (upstream.ok && contentType.startsWith('text/event-stream') && upstream.body) {
    // Pass the stream straight through (spec §7.4); never buffer it.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        'x-accel-buffering': 'no',
      },
    });
  }
  return relayJson(upstream);
}
