import { NextRequest, NextResponse } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';
import { requireAdminToken } from '@/lib/with-hai-core';
import { loadEnv } from '@/config/env';

const API_URL = loadEnv().HAIWAVE_API_URL;

// BFF: admin-gated streaming proxy of the haiCore chat-feedback JSONL export.
// Mirrors src/app/api/admin/audit/route.ts, but streams res.body through
// instead of buffering JSON, and passes through the ndjson content-type +
// content-disposition attachment headers haiCore sets.
export async function GET(request: NextRequest) {
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;
  const { token } = gate;

  const params = request.nextUrl.searchParams.toString();

  try {
    const res = await fetch(`${API_URL}/api/v1/admin/chat-feedback/export?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-HaiWave-Protocol-Version': PROTOCOL_VERSION,
      },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `haiCore ${res.status}` }, { status: res.status });
    }
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/x-ndjson',
        'content-disposition':
          res.headers.get('content-disposition') ??
          `attachment; filename="chat-feedback_${new Date().toISOString().slice(0, 10)}.jsonl"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
