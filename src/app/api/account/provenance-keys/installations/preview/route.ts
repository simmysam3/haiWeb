import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { HaiwaveClient } from '@/lib/haiwave-api';

export const POST = withHaiCore(async ({ client, request }: { client: HaiwaveClient; request: Request }) => {
  const body = (await request.json()) as { key_hash: string };
  return NextResponse.json(await client.previewInstallation(body));
});
