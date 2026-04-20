import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { AuditScopeCreationRequest } from '@haiwave/protocol';

export const GET = withHaiCore(async ({ client, request }) => {
  const sp = request.nextUrl.searchParams;
  const vendorId = sp.get('vendor_id');
  const scopeType = sp.get('scope_type');
  const activeOnly = sp.get('active_only');

  return NextResponse.json(
    await client.listAuditScopes({
      vendorId: vendorId ?? undefined,
      scopeType: scopeType ?? undefined,
      activeOnly: activeOnly === null ? undefined : activeOnly === 'true',
    }),
  );
});

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json()) as AuditScopeCreationRequest;
  return NextResponse.json(await client.createAuditScope(body));
});
