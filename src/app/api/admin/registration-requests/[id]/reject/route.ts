import { NextRequest, NextResponse } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';
import { requireAdminToken } from '@/lib/with-hai-core';
import { loadEnv } from '@/config/env';

const API_URL = loadEnv().HAIWAVE_API_URL;

// BFF: admin-gated reject. `reason` is required — validated locally before
// touching haiCore — then forwarded; upstream body+status passed through.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;
  const { token } = gate;

  const raw = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = typeof raw.reason === 'string' ? raw.reason.trim() : '';
  if (!reason) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'reason is required' } },
      { status: 400 },
    );
  }

  const { id } = await params;

  try {
    const res = await fetch(
      `${API_URL}/api/v1/admin/registration-requests/${encodeURIComponent(id)}/reject`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-HaiWave-Protocol-Version': PROTOCOL_VERSION,
        },
        body: JSON.stringify({ reason }),
      },
    );
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
