import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { CreateRunTemplateRequest } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/templates — list the caller's run templates.
 * POST /api/account/sonar/templates — create a new template.
 *
 * BFF passthrough; auth + scope enforcement happen in haiCore.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.listRunTemplates());
});

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json().catch(() => ({}))) as CreateRunTemplateRequest;
  return NextResponse.json(await client.createRunTemplate(body));
});
