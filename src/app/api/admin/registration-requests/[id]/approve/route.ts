import { NextRequest, NextResponse } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';
import { getSession, getToken } from '@/lib/auth';
import { isJwtLike } from '@/lib/with-hai-core';
import { loadEnv } from '@/config/env';

const API_URL = loadEnv().HAIWAVE_API_URL;

// BFF: admin-gated approve. Forwards {override,reason} to haiCore and passes
// the upstream body+status through VERBATIM so the 409
// { error: { code: 'blocked_requires_override' } } reaches the client.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const token = await getToken();
  if (!isJwtLike(token)) return NextResponse.json({ error: 'No token' }, { status: 401 });

  const { id } = await params;
  const raw = (await request.json().catch(() => ({}))) as {
    override?: boolean;
    reason?: string;
  };
  const body: { override?: boolean; reason?: string } = {};
  if (typeof raw.override === 'boolean') body.override = raw.override;
  if (typeof raw.reason === 'string') body.reason = raw.reason;

  try {
    const res = await fetch(
      `${API_URL}/api/v1/admin/registration-requests/${encodeURIComponent(id)}/approve`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-HaiWave-Protocol-Version': PROTOCOL_VERSION,
        },
        body: JSON.stringify(body),
      },
    );
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
