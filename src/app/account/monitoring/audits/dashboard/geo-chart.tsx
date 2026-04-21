import type { GeoRollupEntry } from '@haiwave/protocol';

// Placeholder stub — full implementation lands in Task 22.
export function GeoChart({ data }: { data: GeoRollupEntry[] }) {
  return (
    <div className="p-4 rounded border border-slate/10">
      Geo chart placeholder ({data.length} rows)
    </div>
  );
}
