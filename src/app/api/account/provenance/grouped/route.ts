import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.listGroupedManifests());
});
