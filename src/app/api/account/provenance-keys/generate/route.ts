import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { HaiwaveClient } from '@/lib/haiwave-api';
import type { ProvenanceKeyCreationRequest } from '@haiwave/protocol';

export const POST = withHaiCore(async ({ client, request }: { client: HaiwaveClient; request: Request }) => {
  const body = (await request.json()) as ProvenanceKeyCreationRequest;
  return NextResponse.json(await client.generateKey(body));
});
