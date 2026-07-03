import { NextRequest, NextResponse } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';
import { requireAdminToken } from '@/lib/with-hai-core';
import { loadEnv } from '@/config/env';

const API_URL = loadEnv().HAIWAVE_API_URL;

// BFF: admin-gated proxy of the haiCore registration holding-pen list.
// Mirrors src/app/api/admin/audit/route.ts.
export async function GET(request: NextRequest) {
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;
  const { token } = gate;

  const params = request.nextUrl.searchParams.toString();

  try {
    const res = await fetch(
      `${API_URL}/api/v1/admin/registration-requests${params ? `?${params}` : ''}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-HaiWave-Protocol-Version': PROTOCOL_VERSION,
        },
      },
    );
    if (!res.ok) {
      return NextResponse.json({ error: `haiCore ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
