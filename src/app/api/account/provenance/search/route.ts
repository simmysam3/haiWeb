import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore(async ({ client, request }) => {
  const sp = request.nextUrl.searchParams;
  const q = sp.get('q') ?? '';
  const limit = sp.get('limit');
  return NextResponse.json(
    await client.searchManifests(q, limit ? Number(limit) : undefined),
  );
});
