import { NextResponse } from 'next/server';
import type { AuditRun, AuditRunResult, WatcherResult } from '@haiwave/protocol';
import { withHaiCore } from '@/lib/with-hai-core';
import { computeRiskScore } from '@/app/account/sonar/dashboard/_lib/risk-score';
import { buildPerPartnerAuditWeights, type PartnerAuditWeight } from '@/app/account/sonar/dashboard/_lib/audit-weights';

interface PhantomDemandPerCounterparty {
  counterparty_participant_id: string;
  counterparty_display_name: string;
  response_rate: number;
}

interface PhantomDemandAggregate {
  header: { window_id: string };
  per_counterparty_summary: PhantomDemandPerCounterparty[];
}

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
}> {
  const latestRes = await client.fetchRaw('/sonar/phantom-demand/reports/latest');
  if (!latestRes.ok) return { byPartner: new Map() };
  const { window_id } = (await latestRes.json()) as { window_id: string };

  const aggRes = await client.fetchRaw(`/sonar/phantom-demand/reports/${window_id}/aggregate`);
  if (!aggRes.ok) return { byPartner: new Map() };
  const agg = (await aggRes.json()) as PhantomDemandAggregate;

  const byPartner = new Map<string, { response_rate: number; window_id: string; name: string | null }>();
  for (const c of agg.per_counterparty_summary) {
    byPartner.set(c.counterparty_participant_id, {
      response_rate: c.response_rate,
      window_id,
      name: c.counterparty_display_name,
    });
  }
  return { byPartner };
}

async function loadWatcher(client: {
  listWatcherRuns: (opts?: { limit?: number }) => Promise<{ runs: Array<{ run_id: string; status: string; triggered_at: string }> }>;
  getWatcherRun: (runId: string) => Promise<{ run: unknown; results: WatcherResult[] }>;
}): Promise<Map<string, WatcherPerPartner>> {
  const { runs } = await client.listWatcherRuns({ limit: 5 });
  const latest = runs.find((r) => r.status === 'complete' || r.status === 'partial');
  if (!latest) return new Map();
  const detail = await client.getWatcherRun(latest.run_id);
  const results = detail.results;

  const byPartner = new Map<string, WatcherPerPartner>();
  for (const r of results) {
    if (!r.counterparty_participant_id) continue;
    const cur = byPartner.get(r.counterparty_participant_id) ?? { capacity_band: null, lead_time_p90_days: null };
    if (r.signal_type === 'capacity_utilization_band' && r.payload && typeof r.payload === 'object' && 'band' in r.payload) {
      cur.capacity_band = (r.payload as { band: CapacityBand }).band;
    }
    if (
      r.signal_type === 'lead_time_distribution' &&
      r.payload &&
      typeof r.payload === 'object' &&
      'percentiles' in r.payload
    ) {
      const p90 = (r.payload as { percentiles: { p90: unknown } }).percentiles?.p90;
      if (typeof p90 === 'number') cur.lead_time_p90_days = p90;
    }
    byPartner.set(r.counterparty_participant_id, cur);
  }
  return byPartner;
}

export const GET = withHaiCore(async ({ client }) => {
  const [audit, pd, watcher] = await Promise.all([
    loadAudit(client).catch(() => ({ perVendor: new Map<string, PartnerAuditWeight>(), resultsByVendor: new Map() })),
    loadPhantomDemand(client).catch(() => ({ byPartner: new Map<string, { response_rate: number; window_id: string; name: string | null }>() })),
    loadWatcher(client).catch(() => new Map<string, WatcherPerPartner>()),
  ]);

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
  });
});
