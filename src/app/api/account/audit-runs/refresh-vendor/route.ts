import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { RefreshVendorRequest } from '@haiwave/protocol';

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json()) as RefreshVendorRequest;
  return NextResponse.json(await client.refreshVendorAudit(body));
});
