import type { AuditRun, AuditRunResult, ClassRollupEntry, GeoRollupEntry } from '@haiwave/protocol';
import { buildPartnerCompliance, type PartnerComplianceData } from './partner-compliance';

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
}

const EMPTY: AuditChartData = {
  rollup: [],
  classRollup: [],
  partnerCompliance: null,
};

export async function loadAuditChartData(
  baseUrl: string,
  cookieHeader: string,
): Promise<AuditChartData> {
  const fetchJson = async <T,>(path: string): Promise<T | null> => {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: cookieHeader },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch (err) {
      console.error('[loadAuditChartData] network failure', { path, err });
      return null;
    }
  };

  const runsRes = await fetchJson<{ runs: AuditRun[] }>('/api/account/audit-runs?limit=25');
  if (!runsRes) return EMPTY;

  const latest = runsRes.runs.find(
    (r) => r.status === 'complete' || r.status === 'partial',
  );
  if (!latest) return EMPTY;

  const [resultsRes, classRes] = await Promise.all([
    fetchJson<{ results: AuditRunResult[] }>(`/api/account/audit-runs/${latest.run_id}/results`),
    fetchJson<{ rollup: ClassRollupEntry[] }>(`/api/account/audit-runs/${latest.run_id}/class-rollup`),
  ]);

  const merged = new Map<string, GeoRollupEntry>();
  if (resultsRes) {
    for (const r of resultsRes.results) {
      for (const e of r.geo_rollup) {
        const cur = merged.get(e.country_of_origin);
        if (!cur) {
          merged.set(e.country_of_origin, {
            ...e,
            depth_distribution: { ...e.depth_distribution },
          });
        } else {
          cur.component_count += e.component_count;
          for (const [d, c] of Object.entries(e.depth_distribution)) {
            cur.depth_distribution[d] = (cur.depth_distribution[d] ?? 0) + c;
          }
        }
      }
    }
  }

  return {
    rollup: [...merged.values()].sort((a, b) => b.component_count - a.component_count),
    classRollup: classRes?.rollup ?? [],
    partnerCompliance: resultsRes ? buildPartnerCompliance(latest, resultsRes.results) : null,
  };
}
