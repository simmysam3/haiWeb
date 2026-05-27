import { cookies, headers } from 'next/headers';
import { PageIntro } from '@/components/page-intro';
import { Panel, PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import { HeaderStrip } from './_components/header-strip';
import { ModalityLens } from './_components/modality-lens';
import { CrossModalityTable } from './_components/cross-modality-table';
import { ActivityFeed } from './_components/activity-feed';
import { DashboardTabs } from './_components/dashboard-tabs';
import { CoverageStatsStrip, type CoverageSnapshot } from './_charts/coverage-stats-strip';
import { CoverageTrendChart } from './_charts/coverage-trend-chart';
import { GeoChart } from './_charts/geo-chart';
import { ClassChart } from './_charts/class-chart';
import { PartnersChart } from './_charts/partners-chart';
import { loadAuditChartData, type AuditChartData } from './_lib/load-audit-charts';
import { getActiveScopes } from '../_lib/scopes';
import { NoScopesCTA } from '../_shared/no-scopes-cta';
import { ScopesErrorBanner } from '../_shared/scopes-error-banner';
import { loadCoverage } from '../_lib/coverage';
import type { FetchResult } from '@/lib/server-fetch';
import type { CoverageCurrentResponse, CoverageTrend } from '@haiwave/protocol';

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

/**
 * Best-effort `FetchResult<T>` → `T | null` adapter. The cross-modality /
 * activity / throttle / templates lanes on the Dashboard are non-canonical
 * overview surfaces — a transport failure shouldn't block the page, just
 * degrade the affected panel (table renders empty, header tiles show
 * zeros). Use this adapter to flatten the unified `fetchBffJson` result
 * into the legacy null-on-failure contract those downstream components
 * already handle (v1.37 polish item 1: unify fetch style on the
 * dashboard).
 */
function unwrapBestEffort<T>(result: FetchResult<T>, lane: string): T | null {
  if (result.kind === 'ok') return result.data;
  // Log so transport failures don't go silently to /dev/null — matches the
  // pre-unification local-fetchJson behavior. `warn` (not `error`) because
  // every callsite is a non-canonical overview lane (cross-modality /
  // activity / throttled-counts / templates) that degrades gracefully — the
  // affected panel renders empty/zero and the rest of the dashboard stands.
  // Operators routinely tune dashboards to ignore `.warn` and alert on
  // `.error`; keeping these noisy at `.error` would page-fatigue against
  // a known-survivable failure mode. Canonical lanes (coverage) bypass
  // this adapter entirely and surface their own status-aware banner.
  console.warn('[loadDashboard] fetch failed', {
    lane,
    status: result.status,
    message: result.message,
  });
  return null;
}

async function loadDashboard(): Promise<DashboardData> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  // v1.37 polish item 1: all BFF lanes now go through `fetchBffJson` so the
  // dashboard speaks a single fetch dialect. Coverage uses the discriminated
  // result directly (status-aware banner); the best-effort lanes adapt to
  // `T | null` via `unwrapBestEffort` so the existing downstream null
  // handling stays intact. `loadAuditChartData` keeps its raw `fetch`
  // because it operates against the broader audit-runs API on a different
  // path prefix and has lane-specific recovery logic.
  const coveragePromise = loadCoverage();
  const [
    crossModalityRes,
    initialActivityRes,
    throttledCountsRes,
    templatesRes,
    coverage,
    charts,
  ] = await Promise.all([
    fetchBffJson<CrossModalityResponse>('/api/account/sonar/dashboard/cross-modality'),
    fetchBffJson<ActivityResponse>('/api/account/sonar/dashboard/activity'),
    fetchBffJson<{ audit: number; watcher: number; total: number }>('/api/account/sonar/runs/throttled/count'),
    fetchBffJson<{ templates: Array<{ enabled: boolean }> }>('/api/account/sonar/templates'),
    coveragePromise,
    loadAuditChartData(baseUrl, cookieHeader),
  ]);

  const crossModality = unwrapBestEffort(crossModalityRes, 'cross-modality');
  const initialActivity = unwrapBestEffort(initialActivityRes, 'activity');
  const throttledCounts = unwrapBestEffort(throttledCountsRes, 'throttled-counts');
  const templates = unwrapBestEffort(templatesRes, 'templates');

  const enabledTemplateCount = templates?.templates.filter((t) => t.enabled).length ?? 0;

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
    coverageCurrent: coverage.current,
    coverageTrend: coverage.trend,
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
    <div className="space-y-8">
      <PageHeader
        title="Sonar Dashboard"
        description="Cross-modality view across audit, phantom demand, and Watcher observations, plus your compliance coverage snapshot."
      />
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

      {/*
        v1.41: the three dashboard surfaces are now real tabs (Coverage /
        Cross-modality / Activity) rather than one long scroll with the old
        sticky anchor sub-nav. Each section is still rendered server-side and
        handed to `DashboardTabs` as a content slot, so tab switching is
        instant (no re-fetch) and the whole dashboard ships in one RSC
        payload. Coverage stays the default tab — it's the user's primary
        morning question ("am I covered?").
      */}
      <DashboardTabs
        tabs={[
          {
            id: 'section-coverage',
            label: 'Coverage',
            content: (
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
            ),
          },
          {
            id: 'section-cross-modality',
            label: 'Cross-modality',
            content: (
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
              </section>
            ),
          },
          {
            id: 'section-activity',
            label: 'Activity',
            content: (
              <section aria-labelledby="dashboard-activity-heading" className="space-y-6">
                <h2
                  id="dashboard-activity-heading"
                  className="font-[family-name:var(--font-display)] text-lg font-bold text-navy"
                >
                  Activity
                </h2>
                <ActivityFeed initial={data.initialActivity} />
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}
