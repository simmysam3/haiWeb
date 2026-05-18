'use client';
import Link from 'next/link';
import { Panel } from '@/components';

export function GapsPanel({
  totalGaps,
  latestAt,
}: {
  totalGaps: number | null;
  latestAt: string | null;
}) {
  if (latestAt === null) {
    return (
      <Panel className="p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">Gaps</h2>
        <p className="text-sm text-slate">No audit has been run yet.</p>
      </Panel>
    );
  }
  return (
    <Panel className="p-4">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">Gaps</h2>
      <p className="text-sm text-charcoal">{totalGaps ?? 0} gap nodes in the latest audit.</p>
      <p className="text-xs text-slate mt-2">
        Typical causes: non-participant suppliers, missing keys, depth-limited branches. Drill into a specific run for per-node detail.
      </p>
      <div className="mt-3 rounded bg-teal/5 border border-teal/30 p-2">
        <Link href="/account/provenance-keys" className="text-teal text-sm font-medium underline">
          Manage provenance keys →
        </Link>
        <p className="text-xs text-slate mt-1">
          Install keys with vendors to reduce <em>unauthorized</em> gaps.
        </p>
      </div>
    </Panel>
  );
}
