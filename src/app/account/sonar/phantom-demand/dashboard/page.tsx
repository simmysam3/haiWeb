import { cookies, headers } from 'next/headers';
import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { PhantomDemandDashboard } from "./phantom-demand-dashboard";
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
 * v1.29: ThrottledRunsPanel added to surface any throttled runs.
 */
export default async function PhantomDemandPage() {
  const throttledCounts = await loadThrottledCounts();
  return (
    <div>
      <ThrottledRunsPanel counts={throttledCounts} />
      <PageHeader
        title="Phantom Demand"
        description="Usage tracking and demand forecast analytics"
      />
      <PageIntro>
        Phantom demand is non-binding BOM-level inquiry — your agent asks the network &ldquo;can you fulfill X units of this part within Y days, and at what price?&rdquo; without placing an order. This dashboard surfaces exception trends, vendor responsiveness, and availability shifts across your bill of materials so procurement can act before a real order is at risk; for the formal output by window, see <em>Phantom Demand Reports</em>.
      </PageIntro>
      <PhantomDemandDashboard />
    </div>
  );
}
