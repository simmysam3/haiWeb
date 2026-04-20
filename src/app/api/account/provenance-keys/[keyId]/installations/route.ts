import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { HaiwaveClient } from '@/lib/haiwave-api';

export const GET = withHaiCore(async ({ client, params }: { client: HaiwaveClient; params: { keyId: string } }) => {
  return NextResponse.json(await client.listInstallationsForKey(params.keyId));
});
