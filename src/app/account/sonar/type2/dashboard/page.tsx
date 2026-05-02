import { cookies, headers } from 'next/headers';
import { PageHeader } from '@/components/page-header';
import { PageIntro } from '@/components/page-intro';
import { Type2Dashboard } from './_components/type2-dashboard';
import { ThrottledRunsPanel } from '@/components/sonar/throttled-runs-panel';

async function loadThrottledCounts(): Promise<{ audit: number; type2: number; total: number }> {
  const zeroThrottled = { audit: 0, type2: 0, total: 0 };
  try {
    const cookieHeader = (await cookies()).toString();
    const reqHeaders = await headers();
    const host = reqHeaders.get('host') ?? 'localhost:3001';
    const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
    const baseUrl = `${proto}://${host}`;
    const res = await fetch(`${baseUrl}/api/account/sonar/runs/throttled/count`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return zeroThrottled;
    return (await res.json()) as { audit: number; type2: number; total: number };
  } catch {
    return zeroThrottled;
  }
}

/**
 * v1.28 Phase 5 — Type 2 (continuous observation) dashboard surface.
 *
 * Shows the caller's run history, the latest snapshot per counterparty
 * (lead time / capacity / delivery), and a button to trigger a new sweep.
 * Spec §8.6.
 *
 * v1.29: ThrottledRunsPanel added to surface any throttled runs.
 */
export default async function Type2DashboardPage() {
  const throttledCounts = await loadThrottledCounts();
  return (
    <div className="p-6">
      <ThrottledRunsPanel counts={throttledCounts} />
      <PageHeader
        title="Type 2 — Continuous observation"
        description="Lead time, capacity, and delivery signals across your tier-1 trading partners."
      />
      <PageIntro>
        Type 2 is continuous observation of your tier-1 trading partners — lead time distribution, capacity utilization band, and recent delivery events — the supply-chain equivalent of a real-time health check. Trigger a sweep, review per-counterparty snapshots, and watch trend lines emerge as your network&apos;s signals refresh.
      </PageIntro>
      <Type2Dashboard />
    </div>
  );
}
