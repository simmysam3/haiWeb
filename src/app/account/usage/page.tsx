import { cookies, headers } from 'next/headers';
import { UsageClient } from './_components/usage-client';

interface CurrentPayload {
  participant_id: string;
  window_start: string;
  consumed: number;
  remaining: number;
  budget: number;
  // v1.30 PR-5: true iff admin wrote a per-participant hourly_hop_budget.
  // Surfaced so HaiWeb does not hardcode haiCore's PLATFORM_DEFAULT_HOP_BUDGET.
  is_custom: boolean;
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
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-charcoal">Usage</h1>
        <p className="text-sm text-slate mt-1">
          Hop consumption against your hourly budget. Use the time-series chart
          and active runs to manage your throughput.
        </p>
      </header>
      <UsageClient initialCurrent={current} />
    </div>
  );
}
