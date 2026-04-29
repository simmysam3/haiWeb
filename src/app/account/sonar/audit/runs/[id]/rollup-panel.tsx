'use client';
import type { AuditRunResult, GeoRollupEntry } from '@haiwave/protocol';
import { GeoChart } from '../../dashboard/geo-chart';

export function RollupPanel({ results }: { results: AuditRunResult[] }) {
  const merged = new Map<string, GeoRollupEntry>();
  for (const r of results) {
    for (const e of r.geo_rollup) {
      const cur = merged.get(e.country_of_origin);
      if (!cur) {
        merged.set(e.country_of_origin, {
          ...e,
          depth_distribution: { ...e.depth_distribution },
        });
      } else {
        cur.component_count += e.component_count;
        for (const [d, c] of Object.entries(e.depth_distribution)) {
          cur.depth_distribution[d] = (cur.depth_distribution[d] ?? 0) + c;
        }
      }
    }
  }
  return (
    <GeoChart
      data={[...merged.values()].sort(
        (a, b) => b.component_count - a.component_count,
      )}
    />
  );
}
