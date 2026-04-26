import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const DELETE = withHaiCore<{ id: string }>(async ({ client, params }) => {
  await client.deleteAuditScope(params.id);
  return new NextResponse(null, { status: 204 });
});
