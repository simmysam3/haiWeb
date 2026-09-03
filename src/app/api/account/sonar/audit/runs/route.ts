import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { AuditRun } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/audit/runs — list audit runs for the caller's org.
 *   Optional query params: status, limit (both forwarded to haiCore; filtering
 *   and pagination are enforced server-side), template_id (v1.85 — the
 *   audit definition page's Run history tab; applied by the haiCore client,
 *   since haiCore's own list takes status + limit only), and archived=true
 *   (v1.85 (2026-09-02), D-206 — archived runs are excluded server-side by
 *   default; this opts the caller in to seeing them).
 *
 * NO POST. The ad-hoc trigger was removed 2026-06-09: it had no UI callers and
 * created template-less runs that can never carry the user-given audit name
 * (the "Run <uuid>"-labeled rows). Every portal trigger goes through the
 * definitions flow (POST /definitions then /definitions/:id/run) so the run is
 * always bound to a named template.
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
  const templateId = sp.get('template_id') ?? undefined;
  const archived = sp.get('archived') === 'true' ? true : undefined;

  const { runs } = await client.listAuditRuns({ status, limit, template_id: templateId, archived });

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

  // v1.85 fix wave (D-206, C1) — haiCore already COALESCEs
  // (live run_templates.template_name, template_name_snapshot) into
  // run.template_name on the wire, so a run whose template was deleted
  // (archived or kept per D-206) still carries its name there even though
  // template_id is now NULL. Prefer the live join (a rename since the run
  // fired should win) but fall back to the wire value instead of discarding
  // it — losing it would permanently unname every archived/kept run.
  type EnrichedRun = Omit<AuditRun, 'template_name'> & { template_name: string | null };
  const enrichedRuns: EnrichedRun[] = runs.map((run): EnrichedRun => {
    const joined = run.template_id ? templateNameById.get(run.template_id) : undefined;
    return { ...run, template_name: joined ?? run.template_name ?? null };
  });

  return NextResponse.json({ runs: enrichedRuns, auditor_country: auditorCountry });
});
