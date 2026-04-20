import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { HaiwaveClient } from '@/lib/haiwave-api';
import type { ProvenanceKeyPatch } from '@haiwave/protocol';

export const PATCH = withHaiCore(async ({ client, request, params }: { client: HaiwaveClient; request: Request; params: { keyId: string } }) => {
  const body = (await request.json()) as ProvenanceKeyPatch;
  return NextResponse.json(await client.updateKey(params.keyId, body));
});

export const DELETE = withHaiCore(async ({ client, params }: { client: HaiwaveClient; params: { keyId: string } }) => {
  return NextResponse.json(await client.revokeKey(params.keyId));
});
