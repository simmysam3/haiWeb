import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { templateId: string };

/** Starts an execution; haiCore dispatches sourcing_map to SourcingMapRunService.start (contract §6.1). Answers { run_id } (d-G4). */
export const POST = withHaiCore<P>(
  ({ client, request, params }) => smForward(client, request, `/sonar/templates/${seg(params.templateId)}/trigger`),
  { role: 'account_admin' },
);
