import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore<{ classSlug: string }>(async ({ client, params, request }) => {
  const sp = request.nextUrl.searchParams;
  const page = sp.get('page');
  const pageSize = sp.get('page_size');
  return NextResponse.json(
    await client.listManifestsByClass(params.classSlug, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    }),
  );
});
