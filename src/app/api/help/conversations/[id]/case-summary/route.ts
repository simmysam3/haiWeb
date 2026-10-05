// src/app/api/help/conversations/[id]/case-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { helpAuth, helpUpstream, relayJson } from '@/lib/help/help-upstream';

const IdSchema = z.string().uuid();

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await helpAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!IdSchema.safeParse(id).success) return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 });
  try {
    return await relayJson(await helpUpstream(auth, `/help/conversations/${id}/case-summary`, { method: 'POST' }));
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
