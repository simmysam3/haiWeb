import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore(async ({ client, request }) => {
  const vendorId = request.nextUrl.searchParams.get('vendor_id');
  if (!vendorId) {
    return NextResponse.json({ error: 'vendor_id is required' }, { status: 400 });
  }
  return NextResponse.json(await client.getAuditCoverage(vendorId));
});
