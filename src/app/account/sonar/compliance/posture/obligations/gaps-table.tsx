'use client';

import type { DownstreamGapEntry, ResolutionClass } from '@haiwave/protocol';

const RESOLUTION_BADGE: Record<ResolutionClass, string> = {
  agentic_eligible: 'bg-green-100 text-green-900 border-green-300',
  pending: 'bg-amber-100 text-amber-900 border-amber-300',
  out_of_band: 'bg-slate/10 text-slate border-slate/30',
};

interface Props {
  entries: DownstreamGapEntry[];
}

export function GapsTable({ entries }: Props) {
  const sorted = [...entries].sort((a, b) => {
    if (b.request_count !== a.request_count) return b.request_count - a.request_count;
    const order = { not_invited: 0, invited: 1, participant: 2 } as const;
    return order[a.on_network_status] - order[b.on_network_status];
  });

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate/30 text-left text-slate">
        <tr>
          <th className="py-3 px-4">SKU</th>
          <th className="py-3 px-4">Subtier vendor</th>
          <th className="py-3 px-4 text-right">Requests</th>
          <th className="py-3 px-4">Observers</th>
          <th className="py-3 px-4">Resolution class</th>
          <th className="py-3 px-4">Path</th>
          <th className="py-3 px-4">Network</th>
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
            <td className="py-3 px-4 text-slate">
              {g.upstream_observer_ids.slice(0, 3).join(', ')}
              {g.upstream_observer_ids.length > 3 ? ` +${g.upstream_observer_ids.length - 3}` : ''}
            </td>
            <td className="py-3 px-4">
              <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${RESOLUTION_BADGE[g.resolution_class]}`}>
                {g.resolution_class}
              </span>
            </td>
            <td className="py-3 px-4 text-slate">{g.estimated_resolution_path}</td>
            <td className="py-3 px-4 text-slate">{g.on_network_status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
