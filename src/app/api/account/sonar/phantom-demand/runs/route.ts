import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET  /api/account/sonar/phantom-demand/runs — list the caller's PD runs.
 * POST /api/account/sonar/phantom-demand/runs — trigger a new template-based PD probe.
 *
 * v1.44 refined-PD: POST now requires a template_id (UUID) and accepts optional
 * qty_override + target_date_override overrides. Auth, scope checks, and probe-limit
 * enforcement all happen in haiCore. The BFF only adds the JWT + participant ctx.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const url = new URL(request.url);
  const runs = await client.listPhantomDemandRuns({
    template_id: url.searchParams.get('template_id') ?? undefined,
    limit: url.searchParams.get('limit')
      ? Number(url.searchParams.get('limit'))
      : undefined,
  });
  return NextResponse.json(runs);
});

const TriggerBodySchema = z.object({
  template_id: z.string().uuid(),
  qty_override: z.number().int().positive().nullable().optional(),
  target_date_override: z.string().nullable().optional(),
});

export const POST = withHaiCore(async ({ client, request }) => {
  const raw = await request.json().catch(() => ({}));
  const parsed = TriggerBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues } },
      { status: 400 },
    );
  }
  const result = await client.triggerPhantomDemand(parsed.data);
  return NextResponse.json(result, { status: 202 });
});
