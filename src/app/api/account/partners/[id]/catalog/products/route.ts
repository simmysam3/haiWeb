import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore<{ id: string }>(async ({ client, params, request }) => {
  const sp = request.nextUrl.searchParams;
  const classId = sp.get('class_id');
  const page = sp.get('page');
  const size = sp.get('size');

  return NextResponse.json(
    await client.listCatalogProducts(params.id, {
      classId: classId ?? undefined,
      page: page ? Number(page) : undefined,
      size: size ? Number(size) : undefined,
    }),
  );
});
