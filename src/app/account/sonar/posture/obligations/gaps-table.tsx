'use client';

import type { DownstreamGapEntry } from '@haiwave/protocol';
import { Pill } from '@/components/pill';

interface Props {
  entries: DownstreamGapEntry[];
}

export function GapsTable({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="p-12 text-center space-y-2">
        <p className="text-base font-medium text-navy">No obligation gaps found.</p>
        <p className="text-sm text-slate">When downstream gaps are detected against your accepted obligations, they will appear here.</p>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    if (b.request_count !== a.request_count) return b.request_count - a.request_count;
    const order = { not_invited: 0, invited: 1, participant: 2 } as const;
    return order[a.on_network_status] - order[b.on_network_status];
  });

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate/30 text-left text-slate">
        <tr>
          <th className="py-3 px-4 font-medium">SKU</th>
          <th className="py-3 px-4 font-medium">Subtier vendor</th>
          <th className="py-3 px-4 font-medium text-right">Requests</th>
          <th className="py-3 px-4 font-medium">Observers</th>
          <th className="py-3 px-4 font-medium">Resolution class</th>
          <th className="py-3 px-4 font-medium">Path</th>
          <th className="py-3 px-4 font-medium">Network</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((g) => (
          <tr key={g.product_id} className="border-b border-slate/10">
            <td className="py-3 px-4 font-medium text-navy">{g.sku_label}</td>
            <td
              className="py-3 px-4 text-slate"
              title={g.internal_subtier_vendor_id ? undefined : 'Subtier vendor identity is added in a future release.'}
            >
              {g.internal_subtier_vendor_name ?? '—'}
            </td>
            <td className="py-3 px-4 text-right">{g.request_count}</td>
            <td className="py-3 px-4 text-slate/80 text-xs">
              {g.upstream_observer_ids.slice(0, 3).join(', ')}
              {g.upstream_observer_ids.length > 3 ? ` +${g.upstream_observer_ids.length - 3}` : ''}
            </td>
            <td className="py-3 px-4">
              <Pill category="resolution_class" value={g.resolution_class}>{g.resolution_class}</Pill>
            </td>
            <td className="py-3 px-4 text-xs text-slate/80">{g.estimated_resolution_path}</td>
            <td className="py-3 px-4 text-xs text-slate/80">{g.on_network_status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
