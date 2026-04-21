import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore<{ id: string }>(async ({ client, request, params }) => {
  const sp = request.nextUrl.searchParams;
  const vendorId = sp.get('vendor_id');
  const productId = sp.get('product_id');

  return NextResponse.json(
    await client.getAuditRunResults(params.id, {
      vendorId: vendorId ?? undefined,
      productId: productId ?? undefined,
    }),
  );
});
