import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { smForward } from '@/lib/sourcing-map/bff';
import { CreateSmRunBodySchema } from '@/lib/sourcing-map/contract';

/** The grounded-forecast wizard's retention default (forecast-wizard.tsx:37); a run keeps a year of executions. */
const SM_RUN_RETENTION_DAYS = 365;

/**
 * POST /api/account/sourcing-map/runs → POST /sonar/templates (contract §6.2).
 * observation_class is forced here, never taken from the caller, the same
 * way the grounded-forecast BFF forces its class (grounded-forecasts/route.ts:39-54).
 */
export const POST = withHaiCore(async ({ client, request }) => {
  const parsed = CreateSmRunBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues } }, { status: 400 });
  }
  const body = {
    observation_class: 'sourcing_map',
    template_name: parsed.data.template_name,
    scope: parsed.data.scope,
    cadence: parsed.data.cadence ?? { kind: 'manual_only' },
    enabled: true,
    retention_days: SM_RUN_RETENTION_DAYS,
  };
  return smForward(client, request, '/sonar/templates', { method: 'POST', body: JSON.stringify(body) });
}, { role: 'account_admin' });
