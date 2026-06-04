import { NextRequest, NextResponse } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';
import { getSession, getToken } from '@/lib/auth';
import { isJwtLike } from '@/lib/with-hai-core';
import { loadEnv } from '@/config/env';

const API_URL = loadEnv().HAIWAVE_API_URL;

// BFF: admin-gated proxy of the haiCore registration holding-pen list.
// Mirrors src/app/api/admin/audit/route.ts.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const token = await getToken();
  if (!isJwtLike(token)) return NextResponse.json({ error: 'No token' }, { status: 401 });

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
