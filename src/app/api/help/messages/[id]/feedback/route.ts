// src/app/api/help/messages/[id]/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { helpAuth, helpUpstream, relayJson } from '@/lib/help/help-upstream';

const IdSchema = z.string().uuid();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await helpAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!IdSchema.safeParse(id).success) return NextResponse.json({ error: 'Invalid message id' }, { status: 400 });
  try {
    return await relayJson(await helpUpstream(auth, `/help/messages/${id}/feedback`, { method: 'POST', body: await request.text() }));
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
