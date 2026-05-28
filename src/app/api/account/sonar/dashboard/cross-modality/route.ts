import { NextResponse } from 'next/server';
import type { AuditRun, AuditRunResult, WatcherResult } from '@haiwave/protocol';
import { withHaiCore } from '@/lib/with-hai-core';
import { computeRiskScore } from '@/app/account/sonar/dashboard/_lib/risk-score';
import { buildPerPartnerAuditWeights, type PartnerAuditWeight } from '@/app/account/sonar/dashboard/_lib/audit-weights';

type CapacityBand = 'low' | 'moderate' | 'high' | 'at_capacity';
const BAND_TO_WEIGHT: Record<CapacityBand, number> = {
  low: 0,
  moderate: 0.33,
  high: 0.67,
  at_capacity: 1,
};

interface WatcherPerPartner {
  capacity_band: CapacityBand | null;
  lead_time_p90_days: number | null;
}

async function loadAudit(client: {
  listAuditRuns: (opts?: { status?: string; limit?: number }) => Promise<{ runs: AuditRun[] }>;
  getAuditRunResults: (
    runId: string,
    opts?: { vendorId?: string; productId?: string },
  ) => Promise<{ results: AuditRunResult[] }>;
}): Promise<{
  perVendor: Map<string, PartnerAuditWeight>;
  resultsByVendor: Map<string, { compliant: number; partial: number; non_compliant: number; total: number }>;
}> {
  const { runs } = await client.listAuditRuns({ status: 'complete', limit: 1 });
  const latest = runs[0];
  if (!latest) return { perVendor: new Map(), resultsByVendor: new Map() };

  // Canonical typed accessor — hits /source-audit/runs/:id/results (the only
  // path haiCore actually registers; the previous hand-rolled /sonar/audit
  // and /audit prefixes 404'd, so audit posture was permanently empty).
  const { results } = await client.getAuditRunResults(latest.run_id);

  const perVendor = buildPerPartnerAuditWeights(latest, results);
  const resultsByVendor = new Map<string, { compliant: number; partial: number; non_compliant: number; total: number }>();
  for (const [vid, w] of perVendor) {
    resultsByVendor.set(vid, {
      compliant: w.total_component_count - w.non_compliant_count,
      non_compliant: w.non_compliant_count,
      partial: 0,
      total: w.total_component_count,
    });
  }
  return { perVendor, resultsByVendor };
}

async function loadPhantomDemand(client: {
  fetchRaw: (path: string, init?: RequestInit) => Promise<Response>;
}): Promise<{
  byPartner: Map<string, { response_rate: number; window_id: string; name: string | null }>;
  degraded: boolean;
}> {
  // Refined PD (v1.44): legacy /reports endpoints + phantom-demand-aggregate
  // endpoint deleted. Per-partner PD data no longer aggregated centrally.
  // Cross-modality shows audit + watcher only. Return empty set gracefully.
  return { byPartner: new Map(), degraded: false };
}

async function loadWatcher(client: {
  listWatcherRuns: (opts?: { limit?: number }) => Promise<{ runs: Array<{ run_id: string; status: string; triggered_at: string }> }>;
  getWatcherRun: (runId: string) => Promise<{ run: unknown; results: WatcherResult[] }>;
}): Promise<{ data: Map<string, WatcherPerPartner>; degraded: boolean }> {
  const { runs } = await client.listWatcherRuns({ limit: 5 });
  // listWatcherRuns is newest-first (service orders by triggered_at desc).
  // Merge across recent complete/partial runs so each partner keeps the most
  // recent value *per signal type* — a later run that emitted only
  // lead_time_distribution must not erase capacity-band context from a
  // slightly older run that did include it.
  const usable = runs.filter(
    (r) => r.status === 'complete' || r.status === 'partial',
  );
  if (usable.length === 0) return { data: new Map(), degraded: false };

  // Fetch details in parallel; a single failing run must not blank the card.
  // Use allSettled so each rejection is captured and logged individually.
  const settled = await Promise.allSettled(
    usable.map((r) => client.getWatcherRun(r.run_id).then((d) => d.results)),
  );

  let anyFailed = false;
  const detailResults: WatcherResult[][] = settled.map((outcome, i) => {
    if (outcome.status === 'rejected') {
      anyFailed = true;
      console.error('[cross-modality] watcher run-detail fetch failed', {
        run_id: usable[i].run_id,
        reason: outcome.reason,
      });
      return [] as WatcherResult[];
    }
    return outcome.value;
  });

  const byPartner = new Map<string, WatcherPerPartner>();
  // Walk newest → oldest; only fill a field that is still unset, so the
  // newest run carrying that signal type wins.
  for (const results of detailResults) {
    for (const r of results) {
      if (!r.counterparty_participant_id) continue;
      const cur = byPartner.get(r.counterparty_participant_id) ?? {
        capacity_band: null,
        lead_time_p90_days: null,
      };
      if (
        cur.capacity_band === null &&
        r.signal_type === 'capacity_utilization_band' &&
        r.payload &&
        typeof r.payload === 'object' &&
        'band' in r.payload
      ) {
        cur.capacity_band = (r.payload as { band: CapacityBand }).band;
      }
      if (
        cur.lead_time_p90_days === null &&
        r.signal_type === 'lead_time_distribution' &&
        r.payload &&
        typeof r.payload === 'object' &&
        'percentiles' in r.payload
      ) {
        const p90 = (r.payload as { percentiles: { p90: unknown } }).percentiles
          ?.p90;
        if (typeof p90 === 'number') cur.lead_time_p90_days = p90;
      }
      byPartner.set(r.counterparty_participant_id, cur);
    }
  }
  return { data: byPartner, degraded: anyFailed };
}

export const GET = withHaiCore(async ({ client }) => {
  const [auditResult, pdResult, watcherResult] = await Promise.allSettled([
    loadAudit(client),
    loadPhantomDemand(client),
    loadWatcher(client),
  ]);

  let audit: Awaited<ReturnType<typeof loadAudit>>;
  let partialAudit = false;
  if (auditResult.status === 'rejected') {
    console.error('[cross-modality] audit load failed', auditResult.reason);
    audit = { perVendor: new Map<string, PartnerAuditWeight>(), resultsByVendor: new Map() };
    partialAudit = true;
  } else {
    audit = auditResult.value;
  }

  let pdData: Awaited<ReturnType<typeof loadPhantomDemand>>;
  let partialPd = false;
  if (pdResult.status === 'rejected') {
    console.error('[cross-modality] phantom-demand load failed', pdResult.reason);
    pdData = { byPartner: new Map<string, { response_rate: number; window_id: string; name: string | null }>(), degraded: false };
    partialPd = true;
  } else {
    pdData = pdResult.value;
    partialPd = pdResult.value.degraded;
  }

  let watcherData: Awaited<ReturnType<typeof loadWatcher>>;
  let partialWatcher = false;
  if (watcherResult.status === 'rejected') {
    console.error('[cross-modality] watcher load failed', watcherResult.reason);
    watcherData = { data: new Map<string, WatcherPerPartner>(), degraded: false };
    partialWatcher = true;
  } else {
    watcherData = watcherResult.value;
    partialWatcher = watcherResult.value.degraded;
  }

  const pd = pdData;
  const watcher = watcherData.data;

  const allPartnerIds = new Set<string>();
  for (const id of audit.perVendor.keys()) allPartnerIds.add(id);
  for (const id of pd.byPartner.keys()) allPartnerIds.add(id);
  for (const id of watcher.keys()) allPartnerIds.add(id);

  const partners = [...allPartnerIds].map((partner_id) => {
    const a = audit.perVendor.get(partner_id);
    const p = pd.byPartner.get(partner_id);
    const w = watcher.get(partner_id);
    const partner_name = a?.vendor_name ?? p?.name ?? null;

    const audit_w = a ? a.weight : null;
    const pd_w = p ? 1 - p.response_rate : null;
    const watcher_w = w && w.capacity_band !== null ? BAND_TO_WEIGHT[w.capacity_band] : null;

    const risk = computeRiskScore({ audit: audit_w, phantom_demand: pd_w, watcher: watcher_w });

    return {
      partner_id,
      partner_name: partner_name ?? partner_id,
      audit: a ? audit.resultsByVendor.get(partner_id) ?? null : null,
      phantom_demand: p ? { response_rate: p.response_rate, window_id: p.window_id } : null,
      watcher:
        w && (w.capacity_band !== null || w.lead_time_p90_days !== null)
          ? { capacity_band: w.capacity_band, lead_time_p90_days: w.lead_time_p90_days }
          : null,
      risk_score: risk.score,
      risk_color: risk.color,
      risk_label: risk.label,
    };
  });

  return NextResponse.json({
    partners,
    generated_at: new Date().toISOString(),
    partial: {
      audit: partialAudit,
      phantom_demand: partialPd,
      watcher: partialWatcher,
    },
  });
});
