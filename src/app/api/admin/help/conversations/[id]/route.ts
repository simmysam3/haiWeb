// src/app/api/admin/help/conversations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PROTOCOL_VERSION } from '@haiwave/protocol';
import { requireAdminToken } from '@/lib/with-hai-core';
import { loadEnv } from '@/config/env';

const IdSchema = z.string().uuid();

// BFF: one redacted help transcript for platform admins (spec §7.6).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const env = loadEnv();
  if (!env.HELP_AGENT_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  if (!IdSchema.safeParse(id).success) return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 });

  try {
    const res = await fetch(`${env.HAIWAVE_API_URL}/api/v1/admin/help/conversations/${id}`, {
      headers: { Authorization: `Bearer ${gate.token}`, 'X-HaiWave-Protocol-Version': PROTOCOL_VERSION },
    });
    if (!res.ok) return NextResponse.json({ error: `haiCore ${res.status}` }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
