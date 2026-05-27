import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { AuditRun, RunTriggerRequest } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/audit/runs — list audit runs for the caller's org.
 *   Optional query params: status, limit (both forwarded to haiCore; filtering
 *   and pagination are enforced server-side).
 *
 * POST /api/account/sonar/audit/runs — ad-hoc trigger an audit run.
 *   Body is a RunTriggerRequest (discriminated on scope_type: 'company' | 'key').
 *   run_origin is NOT a request field — it is determined by haiCore.
 *
 * Enrichment (GET): each run is augmented with the friendly `template_name`
 * (resolved from the run's template_id via a single listRunTemplates fetch
 * and a JS-side map join) so the history table shows "Q1 Coffee Sweep"
 * rather than the UUID prefix. Per-run SKU-resolution counts come straight
 * off the protocol envelope (`total_skus` / `fully_resolved_skus_by_country`
 * since protocol 3.22.0) — haiCore computes them server-side, so the BFF
 * doesn't fan out N+1 results requests like the v.1.41 implementation did.
 *
 * The auditor's HQ country is forwarded as `auditor_country` so the UI knows
 * which country bucket to read out of fully_resolved_skus_by_country.
 */
export const GET = withHaiCore(async ({ client, session, request }) => {
  const sp = request.nextUrl.searchParams;
  const status = sp.get('status') ?? undefined;
  const limitRaw = sp.get('limit');
  const limit = limitRaw === null ? undefined : Number(limitRaw);

  const { runs } = await client.listAuditRuns({ status, limit });

  // Auditor's HQ country (ISO-2, uppercased). Best-effort.
  let auditorCountry: string | undefined;
  try {
    const profile = await client.getCompanyProfile(session.participant.id);
    const locality = (profile as { locality?: { country?: string } }).locality;
    if (locality?.country) auditorCountry = locality.country.toUpperCase();
  } catch {
    // No profile — leave undefined.
  }

  // One templates fetch instead of N per-run template lookups.
  const templateNameById = new Map<string, string>();
  try {
    const { templates } = await client.listRunTemplates();
    for (const t of templates) templateNameById.set(t.template_id, t.template_name);
  } catch {
    // Templates unreachable — names fall back to "Run <uuid>" client-side.
  }

  type EnrichedRun = AuditRun & { template_name?: string };
  const enrichedRuns: EnrichedRun[] = runs.map((run): EnrichedRun => {
    const template_name = run.template_id
      ? templateNameById.get(run.template_id)
      : undefined;
    return template_name ? { ...run, template_name } : run;
  });

  return NextResponse.json({ runs: enrichedRuns, auditor_country: auditorCountry });
});

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json().catch(() => ({}))) as RunTriggerRequest;
  return NextResponse.json(await client.triggerAuditRun(body));
});
