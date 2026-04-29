import { headers } from 'next/headers';
import type { DownstreamGapEntry } from '@haiwave/protocol';
import { GapsTable } from './gaps-table';
import { LeastCompliantPanel } from './least-compliant-panel';
import { RefreshButton } from '@/components/refresh-button';

type FetchResult =
  | { kind: 'ok'; entries: DownstreamGapEntry[] }
  | { kind: 'error'; status: number };

async function fetchGaps(): Promise<FetchResult> {
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const url = `${protocol}://${host}/api/account/sku-obligations/downstream-gaps`;
  try {
    const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
    if (!res.ok) return { kind: 'error', status: res.status };
    return { kind: 'ok', entries: (await res.json()) as DownstreamGapEntry[] };
  } catch {
    return { kind: 'error', status: 0 };
  }
}

export default async function DownstreamGapsPage() {
  const result = await fetchGaps();

  return (
    <div className="px-8 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display text-navy">My Downstream Gaps</h1>
          <p className="mt-2 text-slate">
            Obligations you have accepted that cannot fully resolve due to
            unresolved sub-tier dependencies.
          </p>
        </div>
        <RefreshButton />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-slate/20 bg-white">
          {result.kind === 'error' ? (
            <div className="p-12 text-center">
              <p className="text-red-900">
                Couldn&apos;t load downstream gaps. The audit service is temporarily unavailable.
              </p>
            </div>
          ) : result.entries.length === 0 ? (
            <div className="p-12 text-center text-slate">
              No downstream gaps. This list populates after you accept inbound
              nominations and your audit runs surface unresolved sub-tier
              obligations.
            </div>
          ) : (
            <GapsTable entries={result.entries} />
          )}
        </div>
        <LeastCompliantPanel />
      </div>
    </div>
  );
}
