import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { templateId: string };

/** Readiness + probe estimate without probing (spec §8.3); the Run button shows it (AC 10). */
export const POST = withHaiCore<P>(
  ({ client, request, params }) => smForward(client, request, `/sourcing-map/runs/${seg(params.templateId)}/estimate`),
  { role: 'account_admin' },
);
