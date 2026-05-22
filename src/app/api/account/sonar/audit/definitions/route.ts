import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { CreateRunTemplateRequest } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/audit/definitions — list the caller's audit run templates.
 *
 * haiCore's listRunTemplates returns ALL templates regardless of observation_class.
 * This BFF filters client-side to return only those with observation_class === 'audit'.
 */
export const GET = withHaiCore(async ({ client }) => {
  const { templates } = await client.listRunTemplates();
  const auditTemplates = templates.filter(
    (t) => t.observation_class === 'audit',
  );
  return NextResponse.json({ templates: auditTemplates });
});

/**
 * POST /api/account/sonar/audit/definitions — create a new audit run template.
 *
 * Forces observation_class: 'audit' regardless of what the caller supplies,
 * ensuring this endpoint always creates audit-scoped templates.
 */
export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json().catch(() => ({}))) as CreateRunTemplateRequest;
  // Force observation_class to 'audit'. Spreading a discriminated union confuses TS,
  // so we cast back to the same type after the override.
  const payload = { ...body, observation_class: 'audit' as const } as unknown as CreateRunTemplateRequest;
  return NextResponse.json(await client.createRunTemplate(payload));
});
