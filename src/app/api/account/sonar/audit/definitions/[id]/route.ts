import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { UpdateRunTemplateRequest } from '@haiwave/protocol';

type RouteParams = Record<string, string> & { id: string };

export const PATCH = withHaiCore<RouteParams>(async ({ client, request, params }) => {
  const body = (await request.json().catch(() => ({}))) as UpdateRunTemplateRequest;
  return NextResponse.json(await client.updateRunTemplate(params.id, body));
});

export const DELETE = withHaiCore<RouteParams>(async ({ client, params }) => {
  return NextResponse.json(await client.deleteRunTemplate(params.id));
});
