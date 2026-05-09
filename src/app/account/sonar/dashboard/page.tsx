import { cookies, headers } from 'next/headers';
import { PageIntro } from '@/components/page-intro';
import { HeaderStrip } from './_components/header-strip';
import { ModalityLens } from './_components/modality-lens';
import { CrossModalityTable } from './_components/cross-modality-table';
import { ActivityFeed } from './_components/activity-feed';

interface CrossModalityResponse {
  partners: Array<{
    partner_id: string;
    partner_name: string;
    audit: { compliant: number; partial: number; non_compliant: number; total: number } | null;
    phantom_demand: { response_rate: number; window_id: string } | null;
    type2: { capacity_band: 'low' | 'moderate' | 'high' | 'at_capacity' | null; lead_time_p90_days: number | null } | null;
    risk_score: number;
    risk_color: 'green' | 'yellow' | 'red';
    risk_label: 'normal' | 'elevated' | 'critical';
  }>;
  generated_at: string;
}

interface ActivityResponse {
  events: Array<{
    run_id: string;
    modality: 'audit' | 'type2' | 'phantom_demand';
    status: string;
    triggered_at: string;
    completed_at: string | null;
    run_origin: string;
    detail_href: string;
  }>;
}

interface DashboardData {
  crossModality: CrossModalityResponse | null;
  initialActivity: ActivityResponse | null;
  throttledCounts: { audit: number; type2: number; total: number } | null;
  enabledTemplateCount: number;
  failedRunsLast30d: number | null;
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

  const [crossModality, initialActivity, throttledCounts, templatesRes] = await Promise.all([
    fetchJson<CrossModalityResponse>('/api/account/sonar/dashboard/cross-modality'),
    fetchJson<ActivityResponse>('/api/account/sonar/dashboard/activity'),
    fetchJson<{ audit: number; type2: number; total: number }>('/api/account/sonar/runs/throttled/count'),
    fetchJson<{ templates: Array<{ enabled: boolean }> }>('/api/account/sonar/templates'),
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
  };
}

export default async function UnifiedDashboardPage() {
  const data = await loadDashboard();

  const totalPartners = data.crossModality?.partners.length ?? 0;
  const lastRunAt =
    data.initialActivity && data.initialActivity.events.length > 0
      ? data.initialActivity.events[0].triggered_at
      : null;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-charcoal">Sonar Dashboard</h1>
        <p className="text-sm text-slate">Cross-modality view across audit, phantom demand, and Type 2 observations.</p>
      </header>
      <PageIntro>
        Single landing for the state of your supply-chain visibility — partners observed, latest runs, and aggregate risk across modalities. Drill into any modality for full detail.
      </PageIntro>
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
    </div>
  );
}
