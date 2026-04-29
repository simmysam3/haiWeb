import { headers } from 'next/headers';
import type { DownstreamGapEntry } from '@haiwave/protocol';
import { GapsTable } from './gaps-table';
import { LeastCompliantPanel } from './least-compliant-panel';

async function fetchGaps(): Promise<DownstreamGapEntry[]> {
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const url = `${protocol}://${host}/api/account/sku-obligations/downstream-gaps`;
  const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function DownstreamGapsPage() {
  const entries = await fetchGaps();

  return (
    <div className="px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-display text-navy">My Downstream Gaps</h1>
        <p className="mt-2 text-slate">
          Obligations you have accepted that cannot fully resolve due to
          unresolved sub-tier dependencies.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-slate/20 bg-white">
          {entries.length === 0 ? (
            <div className="p-12 text-center text-slate">
              No downstream gaps. This list populates after you accept inbound
              nominations and your audit runs surface unresolved sub-tier
              obligations.
            </div>
          ) : (
            <GapsTable entries={entries} />
          )}
        </div>
        <LeastCompliantPanel />
      </div>
    </div>
  );
}
