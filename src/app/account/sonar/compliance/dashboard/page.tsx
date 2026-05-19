import { cookies, headers } from 'next/headers';
import { GeoChart } from './geo-chart';
import { ClassChart } from './class-chart';
import { GapsPanel } from './gaps-panel';
import { RunControls } from './run-controls';
import { getActiveScopes } from '../_lib/scopes';
import { NoScopesCTA } from '../_shared/no-scopes-cta';
import { ScopesErrorBanner } from '../_shared/scopes-error-banner';
import { PartnersChart } from './partners-chart';
import { loadAuditChartData, type AuditChartData } from '../_lib/load-audit-charts';
import { PageIntro } from '@/components/page-intro';
import { ThrottledRunsPanel } from '@/components/sonar/throttled-runs-panel';

interface DashboardData extends AuditChartData {
  // null = count fetch failed (renders an "unavailable" banner via the panel).
  // Distinct from {0,0,0} which means "fetch succeeded, nothing throttled".
  throttledCounts: { audit: number; watcher: number; total: number } | null;
}

async function loadDashboard(): Promise<DashboardData> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  const fetchThrottled = async (): Promise<DashboardData['throttledCounts']> => {
    try {
      const res = await fetch(`${baseUrl}/api/account/sonar/runs/throttled/count`, {
        headers: { cookie: cookieHeader },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      return (await res.json()) as DashboardData['throttledCounts'];
    } catch (err) {
      console.error('[loadDashboard] throttled count failure', err);
      return null;
    }
  };

  const [charts, throttledCounts] = await Promise.all([
    loadAuditChartData(baseUrl, cookieHeader),
    fetchThrottled(),
  ]);
  return { ...charts, throttledCounts };
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
