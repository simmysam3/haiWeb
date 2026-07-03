import { PageHeader } from '@/components/page-header';
import { fetchBffJson } from '@/lib/server-fetch';
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

async function loadCurrent(): Promise<CurrentPayload | null> {
  const result = await fetchBffJson<CurrentPayload>('/api/account/usage/current');
  if (result.kind === 'error') {
    console.error('[usage current] fetch failed', { status: result.status, message: result.message });
    return null;
  }
  return result.data;
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
