import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type {
  AuditRun,
  AuditRunResult,
  GeoRollupEntry,
  RunTriggerRequest,
} from '@haiwave/protocol';

/**
 * GET /api/account/sonar/audit/runs — list audit runs for the caller's org.
 *   Optional query params: status, limit (both forwarded to haiCore; filtering
 *   and pagination are enforced server-side).
 *
 * POST /api/account/sonar/audit/runs — ad-hoc trigger an audit run.
 *   Body is a RunTriggerRequest (discriminated on scope_type: 'company' | 'key').
 *   run_origin is NOT a request field — it is determined by haiCore.
 *
 * Enrichment (GET): each run is augmented with the friendly template_name
 * (so the history table shows "Q1 Coffee Sweep" rather than the UUID) and
 * domestic_count / total_count (so the row can show e.g. "🇺🇸 42/78" to
 * encourage chasing fully-resolved-domestic coverage). Each enrichment is
 * best-effort: a failure to fetch a template, a result set, or the auditor
 * profile just leaves those fields undefined/null.
 */

const UNKNOWN_ORIGIN = '<unknown>';

function isFullyDomestic(geoRollup: GeoRollupEntry[], auditorCountry: string): boolean {
  if (geoRollup.length === 0) return false;
  // '<unknown>' will never equal an ISO-2 code, so a single `every` check
  // covers both "no unresolved entries" and "no foreign entries".
  return geoRollup.every((e) => e.country_of_origin === auditorCountry);
}

export const GET = withHaiCore(async ({ client, session, request }) => {
  const sp = request.nextUrl.searchParams;
  const status = sp.get('status') ?? undefined;
  const limitRaw = sp.get('limit');
  const limit = limitRaw === null ? undefined : Number(limitRaw);

  // Primary payload first — anything below is best-effort enrichment.
  const { runs } = await client.listAuditRuns({ status, limit });

  // Auditor's HQ country (ISO-2, uppercased). Drives the domestic-count
  // computation. Without it we can still return template_name + total_count
  // — domestic_count just stays 0.
  let auditorCountry: string | undefined;
  try {
    const profile = await client.getCompanyProfile(session.participant.id);
    const locality = (profile as { locality?: { country?: string } }).locality;
    if (locality?.country) auditorCountry = locality.country.toUpperCase();
  } catch {
    // No profile — leave undefined.
  }

  // Build template_id → template_name map. One call instead of N per-run
  // template fetches.
  const templateNameById = new Map<string, string>();
  try {
    const { templates } = await client.listRunTemplates();
    for (const t of templates) {
      templateNameById.set(t.template_id, t.template_name);
    }
  } catch {
    // Templates unreachable — names just fall back to the UUID prefix client-side.
  }

  // Per-run results fetch is only meaningful for terminal-with-results
  // statuses; everything else has no results to count.
  const STATUSES_WITH_RESULTS = new Set(['complete', 'partial']);

  type EnrichedRun = AuditRun & {
    template_name?: string;
    domestic_count?: number | null;
    total_count?: number | null;
  };

  const enrichedRuns: EnrichedRun[] = await Promise.all(
    runs.map(async (run): Promise<EnrichedRun> => {
      const template_name = run.template_id
        ? templateNameById.get(run.template_id)
        : undefined;

      if (!STATUSES_WITH_RESULTS.has(run.status)) {
        return { ...run, template_name, domestic_count: null, total_count: null };
      }

      let domestic_count: number | null = null;
      let total_count: number | null = null;
      try {
        const { results } = await client.getAuditRunResults(run.run_id);
        total_count = results.length;
        if (auditorCountry) {
          domestic_count = results.reduce(
            (n: number, r: AuditRunResult) =>
              n + (isFullyDomestic(r.geo_rollup, auditorCountry as string) ? 1 : 0),
            0,
          );
        } else {
          domestic_count = 0;
        }
      } catch {
        // Results unreachable for this run — leave the indicator empty.
      }

      return { ...run, template_name, domestic_count, total_count };
    }),
  );

  return NextResponse.json({ runs: enrichedRuns, auditor_country: auditorCountry });
});

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json().catch(() => ({}))) as RunTriggerRequest;
  return NextResponse.json(await client.triggerAuditRun(body));
});
