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
  const parsed = CreateSmRunBodySchema.parse(await request.json());
  const body = {
    observation_class: 'sourcing_map',
    template_name: parsed.template_name,
    scope: parsed.scope,
    cadence: parsed.cadence ?? { kind: 'manual_only' },
    enabled: true,
    retention_days: SM_RUN_RETENTION_DAYS,
  };
  return smForward(client, request, '/sonar/templates', { method: 'POST', body: JSON.stringify(body) });
}, { role: 'account_admin' });
