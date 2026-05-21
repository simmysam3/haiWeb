import { cookies, headers } from 'next/headers';
import type { CoverageCurrentResponse, CoverageTrend } from '@haiwave/protocol';
import { PageIntro } from '@/components/page-intro';
import { Panel } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import { HeaderStrip } from './_components/header-strip';
import { ModalityLens } from './_components/modality-lens';
import { CrossModalityTable } from './_components/cross-modality-table';
import { ActivityFeed } from './_components/activity-feed';
import { CoverageStatsStrip, type CoverageSnapshot } from './_charts/coverage-stats-strip';
import { CoverageTrendChart } from './_charts/coverage-trend-chart';
import { GeoChart } from './_charts/geo-chart';
import { ClassChart } from './_charts/class-chart';
import { PartnersChart } from './_charts/partners-chart';
import { loadAuditChartData, type AuditChartData } from './_lib/load-audit-charts';
import { getActiveScopes } from '../_lib/scopes';
import { NoScopesCTA } from '../_shared/no-scopes-cta';
import { ScopesErrorBanner } from '../_shared/scopes-error-banner';
import type { FetchResult } from '@/lib/server-fetch';

interface CrossModalityResponse {
  partners: Array<{
    partner_id: string;
    partner_name: string;
    audit: { compliant: number; partial: number; non_compliant: number; total: number } | null;
    phantom_demand: { response_rate: number; window_id: string } | null;
    watcher: { capacity_band: 'low' | 'moderate' | 'high' | 'at_capacity' | null; lead_time_p90_days: number | null } | null;
    risk_score: number;
    risk_color: 'green' | 'yellow' | 'red';
    risk_label: 'normal' | 'elevated' | 'critical';
  }>;
  generated_at: string;
  partial: { audit: boolean; phantom_demand: boolean; watcher: boolean };
}

interface ActivityResponse {
  events: Array<{
    run_id: string;
    modality: 'audit' | 'watcher' | 'phantom_demand';
    status: string;
    title: string;
    summary: string;
    outcome: string | null;
    triggered_at: string;
    completed_at: string | null;
    duration_seconds: number | null;
    run_origin: string;
    detail_href: string;
  }>;
}

interface DashboardData {
  crossModality: CrossModalityResponse | null;
  initialActivity: ActivityResponse | null;
  throttledCounts: { audit: number; watcher: number; total: number } | null;
  enabledTemplateCount: number;
  failedRunsLast30d: number | null;
  coverageCurrent: FetchResult<CoverageCurrentResponse>;
  coverageTrend: FetchResult<CoverageTrend>;
  charts: AuditChartData;
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
      console.error('[loadDashboard] fetch failed', { path, err });
      return null;
    }
  };

  // Coverage uses `fetchBffJson` (discriminated FetchResult) so we can render
  // a status-aware error banner the same way `posture/page.tsx` did before
  // v1.37 R2. The cross-modality / activity / throttle / templates lanes
  // still use the local `fetchJson` null-coalescer since they're best-effort
  // for the overview panels.
  const [
    crossModality,
    initialActivity,
    throttledCounts,
    templatesRes,
    coverageCurrent,
    coverageTrend,
    charts,
  ] = await Promise.all([
    fetchJson<CrossModalityResponse>('/api/account/sonar/dashboard/cross-modality'),
    fetchJson<ActivityResponse>('/api/account/sonar/dashboard/activity'),
    fetchJson<{ audit: number; watcher: number; total: number }>('/api/account/sonar/runs/throttled/count'),
    fetchJson<{ templates: Array<{ enabled: boolean }> }>('/api/account/sonar/templates'),
    fetchBffJson<CoverageCurrentResponse>('/api/account/sonar/compliance/coverage/current'),
    fetchBffJson<CoverageTrend>('/api/account/sonar/compliance/coverage/trend'),
    loadAuditChartData(baseUrl, cookieHeader),
  ]);

  const enabledTemplateCount = templatesRes?.templates.filter((t) => t.enabled).length ?? 0;

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const failedRunsLast30d = initialActivity
    ? initialActivity.events.filter(
        (e) => e.status === 'failed' && new Date(e.triggered_at).getTime() >= cutoff,
      ).length
    : null;

  return {
    crossModality,
    initialActivity,
    throttledCounts,
    enabledTemplateCount,
    failedRunsLast30d,
    coverageCurrent,
    coverageTrend,
    charts,
  };
}

export default async function UnifiedDashboardPage() {
  const scopesResult = await getActiveScopes();
  if (scopesResult.kind === 'error') {
    return <div className="p-6"><ScopesErrorBanner status={scopesResult.status} /></div>;
  }
  if (scopesResult.scopes.length === 0) {
    return <div className="p-6"><NoScopesCTA context="dashboard" /></div>;
  }

  const data = await loadDashboard();

  const totalPartners = data.crossModality?.partners.length ?? 0;
  const lastRunAt =
    data.initialActivity && data.initialActivity.events.length > 0
      ? data.initialActivity.events[0].triggered_at
      : null;

  const p = data.crossModality?.partial;
  const anyPartial = p && (p.audit || p.phantom_demand || p.watcher);

  // Coverage surface: the canonical home post v1.37 R2. Transport failures
  // (500/401/403/network) on `current` render a status-aware banner — must
  // NOT collapse into the genuine 0-snapshot onboarding state. (Mirrors the
  // pre-restructure logic from `posture/page.tsx`.)
  const coverageCurrent = data.coverageCurrent;
  const snapshot: CoverageSnapshot | null =
    coverageCurrent.kind === 'ok'
      ? (coverageCurrent.data.snapshot ?? null) as CoverageSnapshot | null
      : null;

  return (
    <div className="p-6 space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-charcoal">Sonar Dashboard</h1>
        <p className="text-sm text-slate">Cross-modality view across audit, phantom demand, and Watcher observations, plus your compliance coverage snapshot.</p>
      </header>
      <PageIntro>
        Single landing for the state of your supply-chain visibility — coverage
        across your latest compliance snapshot, partners observed across all
        modalities, latest runs, and aggregate risk. Drill into any modality
        for full detail.
      </PageIntro>

      {anyPartial && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Risk scores may be incomplete — some signals failed to load. Check server logs for details.
        </p>
      )}

      {/* Coverage section — full surface absorbed from the old /sonar/posture
          landing in v1.37 R2. Sits at the top of the morning overview so it's
          the first thing the user sees. */}
      <section aria-labelledby="dashboard-coverage-heading" className="space-y-6">
        <h2
          id="dashboard-coverage-heading"
          className="font-[family-name:var(--font-display)] text-lg font-bold text-navy"
        >
          Compliance coverage
        </h2>
        {coverageCurrent.kind === 'error' ? (
          <div role="alert">
            <Panel className="p-12 text-center">
              <p className="text-red-900">
                {coverageCurrent.status === 403
                  ? 'You do not have permission to view compliance coverage.'
                  : coverageCurrent.status === 401
                  ? 'Your session has expired. Please sign in again.'
                  : coverageCurrent.status >= 500
                  ? 'Couldn’t load compliance coverage. The audit service is temporarily unavailable.'
                  : coverageCurrent.status === 0
                  ? `Couldn’t reach the audit service${coverageCurrent.message ? `: ${coverageCurrent.message}` : '.'}`
                  : `Couldn’t load compliance coverage (status ${coverageCurrent.status}).`}
              </p>
            </Panel>
          </div>
        ) : !snapshot ? (
          <Panel className="p-8">
            <p className="text-sm text-slate text-center">
              No completed compliance snapshot yet. Run a compliance audit to
              populate your coverage view.
            </p>
          </Panel>
        ) : (
          <>
            <CoverageStatsStrip snapshot={snapshot} />
            <Panel className="p-4">
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-2">
                What these numbers mean
              </h3>
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
            {data.coverageTrend.kind === 'error' ? (
              <div role="alert">
                <Panel className="p-4">
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
                    Coverage trend
                  </h3>
                  <p className="text-sm text-red-900 text-center py-8">
                    Coverage trend is temporarily unavailable.
                  </p>
                </Panel>
              </div>
            ) : (
              <CoverageTrendChart points={data.coverageTrend.data.points as CoverageSnapshot[]} />
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GeoChart data={data.charts.rollup} />
              <ClassChart data={data.charts.classRollup} />
            </div>
            <PartnersChart data={data.charts.partnerCompliance} />
          </>
        )}
      </section>

      {/* Cross-modality overview — pre-v1.37 dashboard content. Sits below
          coverage because coverage is the user's primary morning question
          ("am I covered?") and cross-modality is the deeper drill ("which
          partners are degraded?"). */}
      <section aria-labelledby="dashboard-overview-heading" className="space-y-6">
        <h2
          id="dashboard-overview-heading"
          className="font-[family-name:var(--font-display)] text-lg font-bold text-navy"
        >
          Cross-modality overview
        </h2>
        <HeaderStrip
          totalPartners={totalPartners}
          lastRunAt={lastRunAt}
          throttledCounts={data.throttledCounts}
          failedRunsLast30d={data.failedRunsLast30d}
          enabledTemplateCount={data.enabledTemplateCount}
        />
        <ModalityLens partners={data.crossModality?.partners ?? []} />
        <CrossModalityTable partners={data.crossModality?.partners ?? []} />
        <ActivityFeed initial={data.initialActivity} />
      </section>
    </div>
  );
}
