import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { HaiwaveClient } from '@/lib/haiwave-api';
import type { SharingPolicyUpdateRequest } from '@haiwave/protocol';

export const GET = withHaiCore(async ({ client }: { client: HaiwaveClient }) => {
  return NextResponse.json(await client.getSharingPolicy());
});

export const PUT = withHaiCore(async ({ client, request }: { client: HaiwaveClient; request: Request }) => {
  const body = (await request.json()) as SharingPolicyUpdateRequest;
  return NextResponse.json(await client.upsertSharingPolicy(body));
});
