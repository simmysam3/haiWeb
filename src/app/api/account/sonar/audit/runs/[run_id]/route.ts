import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

type RouteParams = Record<string, string> & { run_id: string };

export const GET = withHaiCore<RouteParams>(async ({ client, params }) => {
  const runId = params.run_id;

  // Primary payload — essential; let any error propagate so withHaiCore can
  // surface the correct status (401/403/404/500).
  const run = await client.getAuditRun(runId);

  // Supplementary: responses dispatched from this run.
  //
  // Forward seam: EvidenceResponseListItem (protocol) has no run-linking field
  // yet — the list schema only carries response_id, scope_shape, sku_count,
  // recipient_name, recipient_type, exported_at, exported_by, document_hash.
  // With no source_run_ids / bound_run_id on the list item there is nothing to
  // filter by, so this is always []. We deliberately do NOT call
  // listEvidenceResponses() here — the result would be discarded. When the
  // protocol adds a run-linking field, fetch + filter:
  // `(await client.listEvidenceResponses()).filter(r => r.source_run_ids?.includes(runId))`.
  const dispatched_responses: unknown[] = [];

  return NextResponse.json({ run, dispatched_responses });
});
