import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { RunTriggerRequest } from '@haiwave/protocol';

export const GET = withHaiCore(async ({ client, request }) => {
  const sp = request.nextUrl.searchParams;
  const status = sp.get('status');
  const limit = sp.get('limit');

  return NextResponse.json(
    await client.listAuditRuns({
      status: status ?? undefined,
      limit: limit === null ? undefined : Number(limit),
    }),
  );
});

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json().catch(() => ({}))) as RunTriggerRequest;
  return NextResponse.json(await client.triggerAuditRun(body));
});
