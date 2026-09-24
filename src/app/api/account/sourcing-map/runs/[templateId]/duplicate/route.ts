import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';
import type { SmRunTemplate } from '@/lib/sourcing-map/contract';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

type P = { templateId: string };
const SUFFIX = ' (copy)';

/**
 * Duplicate run (spec §7.4, contract §6.2): the copy carries the scope —
 * the demand only; products stay shared in the library.
 */
export const POST = withHaiCore<P>(async ({ client, request, params }) => {
  const got = await client.fetchRaw(`/sonar/templates/${seg(params.templateId)}`, { method: 'GET' });
  if (got.status !== 200) return forwardHaiCoreResponse(got);
  const { template } = JSON.parse(await got.text()) as { template: SmRunTemplate };
  const body = {
    observation_class: 'sourcing_map',
    template_name: template.template_name.slice(0, 200 - SUFFIX.length) + SUFFIX,
    scope: template.scope,
    cadence: template.cadence,
    enabled: template.enabled,
    retention_days: template.retention_days,
  };
  return smForward(client, request, '/sonar/templates', { method: 'POST', body: JSON.stringify(body) });
}, { role: 'account_admin' });
