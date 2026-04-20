import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore<{ keyId: string }>(async ({ client, params, request }) => {
  const sp = request.nextUrl.searchParams;
  const page = sp.get('page');
  const page_size = sp.get('page_size');
  const event_type = sp.get('event_type');

  const audit = await client.listKeyAudit(params.keyId, {
    page: page ? Number(page) : undefined,
    page_size: page_size ? Number(page_size) : undefined,
    event_type: event_type ?? undefined,
  });
  return NextResponse.json(audit);
});
