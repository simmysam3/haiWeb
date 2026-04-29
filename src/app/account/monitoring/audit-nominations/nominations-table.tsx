'use client';

import type { InboundNominationGroup } from './_lib/types';
import { formatStatusMix } from './_lib/format-status-mix';

interface Props {
  groups: InboundNominationGroup[];
}

export function NominationsTable({ groups }: Props) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate/30 text-left text-slate">
        <tr>
          <th className="py-3 px-4">SKU</th>
          <th className="py-3 px-4">Requests</th>
          <th className="py-3 px-4">Status</th>
          <th className="py-3 px-4">Earliest</th>
          <th className="py-3 px-4 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr key={g.product_id} className="border-b border-slate/10">
            <td className="py-3 px-4 font-medium text-navy">{g.sku_label}</td>
            <td className="py-3 px-4">{g.request_count}</td>
            <td className="py-3 px-4">{formatStatusMix(g.status_mix)}</td>
            <td className="py-3 px-4">{new Date(g.earliest_arrival).toLocaleString()}</td>
            <td className="py-3 px-4 text-right text-slate">—</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
