import { cookies, headers } from 'next/headers';
import type { AuditRun, AuditRunResult, ClassRollupEntry, GeoRollupEntry } from '@haiwave/protocol';
import { GeoChart } from './geo-chart';
import { ClassChart } from './class-chart';
import { GapsPanel } from './gaps-panel';
import { RunControls } from './run-controls';
import { getActiveScopes } from '../_lib/scopes';
import { NoScopesCTA } from '../_shared/no-scopes-cta';
import { PartnersChart } from './partners-chart';
import { buildPartnerCompliance, type PartnerComplianceData } from './_lib/partner-compliance';

interface DashboardData {
  rollup: GeoRollupEntry[];
  classRollup: ClassRollupEntry[];
  gaps: number | null;
  latestAt: string | null;
  partnerCompliance: PartnerComplianceData | null;
}

async function loadDashboard(): Promise<DashboardData> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  const fetchJson = async <T,>(path: string): Promise<T | null> => {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: cookieHeader },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  };

  const runsRes = await fetchJson<{ runs: AuditRun[] }>(
    '/api/account/audit-runs?limit=25',
  );
  if (!runsRes) return { rollup: [], classRollup: [], gaps: null, latestAt: null, partnerCompliance: null };

  const latest = runsRes.runs.find(
    (r) => r.status === 'complete' || r.status === 'partial',
  );
  if (!latest) return { rollup: [], classRollup: [], gaps: null, latestAt: null, partnerCompliance: null };

  const [resultsRes, classRes] = await Promise.all([
    fetchJson<{ results: AuditRunResult[] }>(
      `/api/account/audit-runs/${latest.run_id}/results`,
    ),
    fetchJson<{ rollup: ClassRollupEntry[] }>(
      `/api/account/audit-runs/${latest.run_id}/class-rollup`,
    ),
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
    rollup: [...merged.values()].sort(
      (a, b) => b.component_count - a.component_count,
    ),
    classRollup: classRes?.rollup ?? [],
    gaps: latest.gap_count ?? 0,
    latestAt: latest.triggered_at,
    partnerCompliance: resultsRes ? buildPartnerCompliance(latest, resultsRes.results) : null,
  };
}

export default async function DashboardPage() {
  const scopes = await getActiveScopes();
  if (scopes.length === 0) {
    return (
      <div className="p-6">
        <NoScopesCTA context="dashboard" />
      </div>
    );
  }
  const data = await loadDashboard();
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-charcoal">Audit Dashboard</h1>
          {data.latestAt && (
            <p className="text-sm text-slate">
              Last run: {new Date(data.latestAt).toLocaleString()}
            </p>
          )}
        </div>
        <RunControls />
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GeoChart data={data.rollup} />
        <ClassChart data={data.classRollup} />
        <GapsPanel totalGaps={data.gaps} latestAt={data.latestAt} />
      </div>
      <PartnersChart data={data.partnerCompliance} />
    </div>
  );
}
