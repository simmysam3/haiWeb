import { cookies, headers } from 'next/headers';
import { PageHeader } from '@/components/page-header';
import { UsageClient } from './_components/usage-client';

interface CurrentPayload {
  participant_id: string;
  window_start: string;
  consumed: number;
  remaining: number;
  budget: number;
  // v1.30 PR-5: is_custom flags + probe limit surfaced so HaiWeb does not
  // hardcode haiCore's PLATFORM_DEFAULT_* constants for §7.2 labels.
  is_custom: boolean;
  phantom_demand_inbound_probe_limit: number;
  phantom_demand_inbound_probe_limit_is_custom: boolean;
}

async function getBaseUrl(): Promise<string> {
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

async function loadCurrent(): Promise<CurrentPayload | null> {
  const baseUrl = await getBaseUrl();
  const cookieHeader = (await cookies()).toString();
  try {
    const res = await fetch(`${baseUrl}/api/account/usage/current`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as CurrentPayload;
  } catch (err) {
    console.error('[usage current] fetch failed', err);
    return null;
  }
}

export default async function UsagePage() {
  const current = await loadCurrent();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage"
        description="Hop consumption against your hourly budget. Use the time-series chart and active runs to manage your throughput."
      />
      <UsageClient initialCurrent={current} />
    </div>
  );
}
