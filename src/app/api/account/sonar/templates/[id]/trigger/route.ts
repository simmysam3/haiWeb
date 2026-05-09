import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

type RouteParams = Record<string, string> & { id: string };

export const POST = withHaiCore<RouteParams>(async ({ client, params }) => {
  return NextResponse.json(await client.triggerRunTemplate(params.id));
});
