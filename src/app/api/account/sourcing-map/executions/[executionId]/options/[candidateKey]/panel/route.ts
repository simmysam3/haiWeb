import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { executionId: string; candidateKey: string };

export const GET = withHaiCore<P>(
  ({ client, request, params }) => {
    // Next hands the key decoded; encodeURIComponent leaves `.` and `..` bare,
    // which the URL parser would normalise into another haiCore path (G-34).
    if (params.candidateKey === '.' || params.candidateKey === '..') {
      throw Object.assign(new Error('Not found'), { status: 404 });
    }
    return smForward(
      client,
      request,
      `/sourcing-map/executions/${seg(params.executionId)}/options/${encodeURIComponent(params.candidateKey)}/panel`,
    );
  },
  { role: 'account_admin' },
);
