import { cookies, headers } from 'next/headers';
import type { CoverageCurrentResponse, CoverageTrend } from '@haiwave/protocol';
import { getActiveScopes } from '../../_lib/scopes';
import { NoScopesCTA } from '../../_shared/no-scopes-cta';
import { ScopesErrorBanner } from '../../_shared/scopes-error-banner';
import { loadAuditChartData } from '../../_lib/load-audit-charts';
import { GeoChart } from '../../dashboard/geo-chart';
import { ClassChart } from '../../dashboard/class-chart';
import { PartnersChart } from '../../dashboard/partners-chart';
import { CoverageStatsStrip, type CoverageSnapshot } from './coverage-stats-strip';
import { CoverageTrendChart } from './coverage-trend-chart';
import { PageIntro } from '@/components/page-intro';
import { Panel } from '@/components';

async function fetchJson<T>(baseUrl: string, path: string, cookieHeader: string): Promise<T | null> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.error('[coverage/page] fetch failure', { path, err });
    return null;
  }
}

export default async function CoveragePage() {
  const scopesResult = await getActiveScopes();
  if (scopesResult.kind === 'error') {
    return <div className="p-6"><ScopesErrorBanner status={scopesResult.status} /></div>;
  }
  if (scopesResult.scopes.length === 0) {
    return <div className="p-6"><NoScopesCTA context="dashboard" /></div>;
  }

  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  const [currentRes, trendRes, charts] = await Promise.all([
    fetchJson<CoverageCurrentResponse>(baseUrl, '/api/account/sonar/compliance/coverage/current', cookieHeader),
    fetchJson<CoverageTrend>(baseUrl, '/api/account/sonar/compliance/coverage/trend', cookieHeader),
    loadAuditChartData(baseUrl, cookieHeader),
  ]);

  const snapshot = (currentRes?.snapshot ?? null) as CoverageSnapshot | null;
  const trendPoints = (trendRes?.points ?? []) as CoverageSnapshot[];

  // P6-D3: 0 completed snapshots → whole-page onboarding empty-state.
  if (!snapshot) {
    return (
      <div className="p-6 space-y-6">
        <PageIntro>
          How much of your supply chain you can currently see, and whether that
          coverage is improving over time. Coverage is derived from your
          completed compliance snapshots.
        </PageIntro>
        <Panel className="p-8">
          <p className="text-sm text-slate text-center">
            No completed compliance snapshot yet. Run a compliance audit to
            populate your coverage view.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageIntro>
        How much of your supply chain you can currently see, and whether that
        coverage is improving over time. The stats and trend are derived from
        your completed compliance snapshots; the breakdowns below reflect your
        most recent audit run.
      </PageIntro>
      <CoverageStatsStrip snapshot={snapshot} />
      <CoverageTrendChart points={trendPoints} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GeoChart data={charts.rollup} />
        <ClassChart data={charts.classRollup} />
      </div>
      <PartnersChart data={charts.partnerCompliance} />
    </div>
  );
}
