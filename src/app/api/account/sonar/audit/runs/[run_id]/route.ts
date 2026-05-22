import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

type RouteParams = Record<string, string> & { run_id: string };

export const GET = withHaiCore<RouteParams>(async ({ client, params }) => {
  const runId = params.run_id;

  // Primary payload — essential; let any error propagate so withHaiCore can
  // surface the correct status (401/403/404/500).
  const run = await client.getAuditRun(runId);

  // Supplementary: responses linked to this run.
  //
  // NOTE (v.1.39 as-built): EvidenceResponseListItem (protocol) has no
  // run-linking field — the list schema only carries response_id, scope_shape,
  // sku_count, recipient_name, recipient_type, exported_at, exported_by,
  // document_hash. There is no source_run_ids or bound_run_id on the list
  // item.  Per §6a spec, dispatched_responses is forward-looking for a future
  // phase; for now it is always [].
  //
  // If/when the protocol adds a run-linking field, replace this block with a
  // filtered fetch: `responses.filter(r => r.source_run_ids?.includes(runId))`.
  //
  // We still call listEvidenceResponses() defensively so a future phase can
  // simply add the filter without restructuring this route; failures are
  // swallowed because this is supplementary.
  let dispatched_responses: unknown[] = [];
  try {
    await client.listEvidenceResponses();
    // No run-linking field on list items → always empty in v.1.39.
    dispatched_responses = [];
  } catch {
    // best-effort only — do not fail the whole route
    console.warn('[audit/runs/[run_id]] listEvidenceResponses failed; returning empty dispatched_responses');
  }

  return NextResponse.json({ run, dispatched_responses });
});
