import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const POST = withHaiCore<{ id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.cancelAuditRun(params.id));
});
