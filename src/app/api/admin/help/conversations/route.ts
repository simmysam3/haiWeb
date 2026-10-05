// src/app/api/admin/help/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';
import { requireAdminToken } from '@/lib/with-hai-core';
import { loadEnv } from '@/config/env';

// BFF: admin-gated proxy of haiCore's HAIWAVE Help review list (spec §7.6).
// Mirrors src/app/api/admin/chat-feedback/route.ts.
export async function GET(request: NextRequest) {
  const env = loadEnv();
  if (!env.HELP_AGENT_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;

  const params = request.nextUrl.searchParams.toString();
  try {
    const res = await fetch(`${env.HAIWAVE_API_URL}/api/v1/admin/help/conversations${params ? `?${params}` : ''}`, {
      headers: { Authorization: `Bearer ${gate.token}`, 'X-HaiWave-Protocol-Version': PROTOCOL_VERSION },
    });
    if (!res.ok) return NextResponse.json({ error: `haiCore ${res.status}` }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
