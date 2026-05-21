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
import { fetchBffJson } from '@/lib/server-fetch';

export default async function CoveragePage() {
  const scopesResult = await getActiveScopes();
  if (scopesResult.kind === 'error') {
    return <div className="p-6"><ScopesErrorBanner status={scopesResult.status} /></div>;
  }
  if (scopesResult.scopes.length === 0) {
    return <div className="p-6"><NoScopesCTA context="dashboard" /></div>;
  }

  // `loadAuditChartData` is a shared loader with its own (baseUrl, cookieHeader)
  // signature; keep computing those locally for that call. The coverage current/
  // trend fetches use the shared `fetchBffJson` helper.
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  const [currentResult, trendResult, charts] = await Promise.all([
    fetchBffJson<CoverageCurrentResponse>(
      '/api/account/sonar/compliance/coverage/current',
    ),
    fetchBffJson<CoverageTrend>(
      '/api/account/sonar/compliance/coverage/trend',
    ),
    loadAuditChartData(baseUrl, cookieHeader),
  ]);

  // C1/I1: a transport failure (500/401/403/network) on `current` must NOT
  // collapse into the genuine 0-snapshot onboarding state — that would mask
  // an outage or scope misconfiguration on a compliance surface. Render a
  // status-aware whole-coverage error banner instead.
  if (currentResult.kind === 'error') {
    return (
      <div className="p-6">
        <div role="alert">
          <Panel className="p-12 text-center">
            <p className="text-red-900">
              {currentResult.status === 403
                ? 'You do not have permission to view compliance coverage.'
                : currentResult.status === 401
                ? 'Your session has expired. Please sign in again.'
                : currentResult.status >= 500
                ? 'Couldn’t load compliance coverage. The audit service is temporarily unavailable.'
                : currentResult.status === 0
                ? `Couldn’t reach the audit service${currentResult.message ? `: ${currentResult.message}` : '.'}`
                : `Couldn’t load compliance coverage (status ${currentResult.status}).`}
            </p>
          </Panel>
        </div>
      </div>
    );
  }

  // CoverageCurrent (protocol) and CoverageSnapshot (local mirror) are
  // structurally identical; we cast to the mirror because the client child
  // CoverageTrendChart must consume the mirror type (Turbopack/file: CJS
  // constraint, same as posture/changes/filter-pills.tsx) — not a shape fix.
  const snapshot = (currentResult.data.snapshot ?? null) as CoverageSnapshot | null;

  // P6-D3: 0 completed snapshots (genuine empty) → whole-page onboarding
  // empty-state. Only reachable when `current` succeeded.
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
      <Panel className="p-4">
        <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-2">
          What these numbers mean
        </h2>
        <ul className="text-sm text-slate space-y-1.5">
          <li>
            <span className="font-medium text-teal">Complete</span>
            {' '}— products with full evidence captured for every required compliance attribute.
          </li>
          <li>
            <span className="font-medium text-orange">Partial</span>
            {' '}— products with some but not all required attributes; the gap is recorded as an obligation or working-list item.
          </li>
          <li>
            <span className="font-medium text-slate">No traversal</span>
            {' '}— products in scope that the audit could not reach (responder declined, edge unauthorized, or no downstream visibility).
          </li>
        </ul>
      </Panel>
      {trendResult.kind === 'error' ? (
        // Secondary surface: a trend transport failure must not be mistaken
        // for the genuine "<2 snapshots" onboarding copy in CoverageTrendChart.
        // Concise status-aware notice (full 403/401 branching is reserved for
        // the primary `current` surface above).
        <div role="alert">
          <Panel className="p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
              Coverage trend
            </h2>
            <p className="text-sm text-red-900 text-center py-8">
              Coverage trend is temporarily unavailable.
            </p>
          </Panel>
        </div>
      ) : (
        <CoverageTrendChart points={trendResult.data.points as CoverageSnapshot[]} />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GeoChart data={charts.rollup} />
        <ClassChart data={charts.classRollup} />
      </div>
      <PartnersChart data={charts.partnerCompliance} />
    </div>
  );
}
