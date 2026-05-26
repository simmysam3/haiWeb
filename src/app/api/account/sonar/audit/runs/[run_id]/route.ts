import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

type RouteParams = Record<string, string> & { run_id: string };

export const GET = withHaiCore<RouteParams>(async ({ client, params, session }) => {
  const runId = params.run_id;

  // Primary payload — essential; let any error propagate so withHaiCore can
  // surface the correct status (401/403/404/500).
  const run = await client.getAuditRun(runId);

  // Enrich with the user-given audit name (template_name) so the page H1 can
  // show "Q1 Coffee Supplier Sweep" rather than "Run aaaaaa…". The wizard
  // always creates a template before triggering a run, so template_id should
  // be present; a deleted template is best-effort — fall back silently.
  let template_name: string | undefined;
  if (run.template_id) {
    try {
      const { template } = await client.getRunTemplate(run.template_id);
      template_name = template.template_name;
    } catch {
      // Template deleted / inaccessible — UI falls back to "Run <uuid>".
    }
  }

  // Auditor's domestic country (ISO-2). Drives the per-SKU domestic-flag
  // badge in the evidence tree: SKUs whose geo_rollup resolves entirely to
  // this country get a small flag icon on the header row. Best-effort —
  // a profile lookup failure just hides the badge.
  let auditor_country: string | undefined;
  try {
    const profile = await client.getCompanyProfile(session.participant.id);
    const locality = (profile as { locality?: { country?: string } }).locality;
    if (locality?.country) {
      auditor_country = locality.country.toUpperCase();
    }
  } catch {
    // No profile or fetch failed — badge stays off.
  }

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

  return NextResponse.json({
    run: template_name ? { ...run, template_name } : run,
    dispatched_responses,
    auditor_country,
  });
});
