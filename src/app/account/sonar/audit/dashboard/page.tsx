import { cookies, headers } from 'next/headers';
import type { AuditRun, AuditRunResult, ClassRollupEntry, GeoRollupEntry } from '@haiwave/protocol';
import { GeoChart } from './geo-chart';
import { ClassChart } from './class-chart';
import { GapsPanel } from './gaps-panel';
import { RunControls } from './run-controls';
import { getActiveScopes } from '../_lib/scopes';
import { NoScopesCTA } from '../_shared/no-scopes-cta';
import { ScopesErrorBanner } from '../_shared/scopes-error-banner';
import { PartnersChart } from './partners-chart';
import { buildPartnerCompliance, type PartnerComplianceData } from './_lib/partner-compliance';
import { PageIntro } from '@/components/page-intro';
import { ThrottledRunsPanel } from '@/components/sonar/throttled-runs-panel';

interface DashboardData {
  rollup: GeoRollupEntry[];
  classRollup: ClassRollupEntry[];
  gaps: number | null;
  latestAt: string | null;
  partnerCompliance: PartnerComplianceData | null;
  // null = count fetch failed (renders an "unavailable" banner via the panel).
  // Distinct from {0,0,0} which means "fetch succeeded, nothing throttled".
  throttledCounts: { audit: number; type2: number; total: number } | null;
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
    } catch (err) {
      console.error('[loadDashboard] network failure', { path, err });
      return null;
    }
  };

  const [runsRes, throttledCounts] = await Promise.all([
    fetchJson<{ runs: AuditRun[] }>('/api/account/audit-runs?limit=25'),
    fetchJson<{ audit: number; type2: number; total: number }>(
      '/api/account/sonar/runs/throttled/count',
    ),
  ]);
  // Pass throttledCounts through verbatim — null means "count unavailable" and
  // the panel renders a degraded-state banner; collapsing to zeros would hide
  // the failure from the operator.
  if (!runsRes) return { rollup: [], classRollup: [], gaps: null, latestAt: null, partnerCompliance: null, throttledCounts };

  const latest = runsRes.runs.find(
    (r) => r.status === 'complete' || r.status === 'partial',
  );
  if (!latest) return { rollup: [], classRollup: [], gaps: null, latestAt: null, partnerCompliance: null, throttledCounts };

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
    throttledCounts,
  };
}

export default async function DashboardPage() {
  const scopesResult = await getActiveScopes();
  if (scopesResult.kind === 'error') {
    return (
      <div className="p-6">
        <ScopesErrorBanner status={scopesResult.status} />
      </div>
    );
  }
  if (scopesResult.scopes.length === 0) {
    return (
      <div className="p-6">
        <NoScopesCTA context="dashboard" />
      </div>
    );
  }
  const data = await loadDashboard();
  return (
    <div className="p-6 space-y-6">
      <ThrottledRunsPanel counts={data.throttledCounts} />
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
      <PageIntro>
        A visual roll-up of your most recent supply-chain audit run — where components originated geographically, which product classes show the most disclosure gaps, and how each trading partner is performing on compliance. Trigger a fresh run from here and drill into individual gaps; the per-run history and run controls themselves live in <em>Audit Runs</em>.
      </PageIntro>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GeoChart data={data.rollup} />
        <GapsPanel totalGaps={data.gaps} latestAt={data.latestAt} />
      </div>
      <ClassChart data={data.classRollup} />
      <PartnersChart data={data.partnerCompliance} />
    </div>
  );
}
