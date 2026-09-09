import type { AuditRun, AuditRunResult, ClassRollupEntry, GeoRollupEntry } from '@haiwave/protocol';
import { buildPartnerCompliance, type PartnerComplianceData } from './partner-compliance';
import { rollupFor, type Dimension } from '@/app/account/sonar/_lib/origin-dimension';
import { fetchBffJson } from '@/lib/server-fetch';

/**
 * v1.34 P6 — shared loader for the audit-run-derived charts (Geo / Class /
 * Partners). Sourced from the latest completed audit run via existing BFF
 * endpoints (P6-D5). Extracted from the Audit Dashboard loader —
 * behaviorally equivalent (early-returns consolidated into EMPTY, log prefix
 * renamed). Coverage was folded into the Sonar Dashboard in v1.37 R2, so the
 * Sonar Dashboard page is now the sole consumer (P6-D5).
 */
export interface AuditChartData {
  rollup: GeoRollupEntry[];
  classRollup: ClassRollupEntry[];
  partnerCompliance: PartnerComplianceData | null;
  // D-219 (2026-09-08): the same two datasets per origin dimension for the dashboard lens; `rollup`
  // and `partnerCompliance` stay the manufacturing entries so untouched consumers keep their meaning.
  rollupByDimension: Record<Dimension, GeoRollupEntry[]>;
  partnerComplianceByDimension: Record<Dimension, PartnerComplianceData | null>;
  auditorCountry: string | undefined;
  latestRunId: string | null;
}

const EMPTY: AuditChartData = {
  rollup: [],
  classRollup: [],
  partnerCompliance: null,
  rollupByDimension: { manufacturing: [], design: [], firmware: [] },
  partnerComplianceByDimension: { manufacturing: null, design: null, firmware: null },
  auditorCountry: undefined,
  latestRunId: null,
};

/** Sum one dimension's rollups across the run's results by country, depth keys merged, most components first. */
function mergeRollups(results: AuditRunResult[], dimension: Dimension): GeoRollupEntry[] {
  const merged = new Map<string, GeoRollupEntry>();
  for (const r of results) {
    for (const e of rollupFor(r, dimension)) {
      const cur = merged.get(e.country_of_origin);
      if (!cur) {
        merged.set(e.country_of_origin, { ...e, depth_distribution: { ...e.depth_distribution } });
      } else {
        cur.component_count += e.component_count;
        for (const [d, c] of Object.entries(e.depth_distribution)) {
          cur.depth_distribution[d] = (cur.depth_distribution[d] ?? 0) + c;
        }
      }
    }
  }
  return [...merged.values()].sort((a, b) => b.component_count - a.component_count);
}

export async function loadAuditChartData(): Promise<AuditChartData> {
  // D-62: the BFF origin comes from the configured PORTAL_BASE_URL inside
  // `fetchBffJson` (never from the request's Host header); the cookie is
  // forwarded there too, so callers pass nothing request-derived.
  const fetchJson = async <T,>(path: string): Promise<T | null> => {
    const result = await fetchBffJson<T>(path);
    if (result.kind === 'ok') return result.data;
    if (result.status === 0) {
      console.error('[loadAuditChartData] network failure', { path, err: result.message });
    }
    return null;
  };

  // D-219 (2026-09-08): the enriched runs route also carries the auditor's own HQ country, which
  // replaces the hard-coded 'US' compliant country downstream.
  const runsRes = await fetchJson<{ runs: AuditRun[]; auditor_country?: string }>('/api/account/sonar/audit/runs?limit=25');
  if (!runsRes) return EMPTY;
  const auditorCountry = runsRes.auditor_country;

  const latest = runsRes.runs.find(
    (r) => r.status === 'complete' || r.status === 'partial',
  );
  if (!latest) return EMPTY;

  const [resultsRes, classRes] = await Promise.all([
    fetchJson<{ results: AuditRunResult[] }>(`/api/account/audit-runs/${latest.run_id}/results`),
    fetchJson<{ rollup: ClassRollupEntry[] }>(`/api/account/audit-runs/${latest.run_id}/class-rollup`),
  ]);

  const results = resultsRes?.results ?? [];
  const rollupByDimension = { manufacturing: mergeRollups(results, 'manufacturing'), design: mergeRollups(results, 'design'), firmware: mergeRollups(results, 'firmware') };
  const compliance = (d: Dimension): PartnerComplianceData | null =>
    resultsRes && auditorCountry ? buildPartnerCompliance(latest, results, auditorCountry, d) : null;
  const partnerComplianceByDimension = { manufacturing: compliance('manufacturing'), design: compliance('design'), firmware: compliance('firmware') };

  return {
    rollup: rollupByDimension.manufacturing,
    classRollup: classRes?.rollup ?? [],
    partnerCompliance: partnerComplianceByDimension.manufacturing,
    rollupByDimension,
    partnerComplianceByDimension,
    auditorCountry,
    latestRunId: latest.run_id,
  };
}
