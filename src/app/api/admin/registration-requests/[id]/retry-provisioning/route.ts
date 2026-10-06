import { NextResponse } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';
import { requireAdminToken } from '@/lib/with-hai-core';
import { loadEnv } from '@/config/env';

const API_URL = loadEnv().HAIWAVE_API_URL;

// BFF: admin-gated retry of provisioning for an approved request whose setup
// email failed. The action takes no body: it forwards `{}` and passes the
// upstream body+status through VERBATIM so every refusal
// ({ error: { code, details? } }) reaches the client.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;
  const { token } = gate;

  const { id } = await params;
  try {
    const res = await fetch(
      `${API_URL}/api/v1/admin/registration-requests/${encodeURIComponent(id)}/retry-provisioning`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-HaiWave-Protocol-Version': PROTOCOL_VERSION,
        },
        body: '{}',
      },
    );
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
