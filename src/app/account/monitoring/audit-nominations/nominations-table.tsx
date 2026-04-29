'use client';

import { useState } from 'react';
import type { InboundNominationGroup } from './_lib/types';
import { formatStatusMix } from './_lib/format-status-mix';

interface Props {
  groups: InboundNominationGroup[];
}

export function NominationsTable({ groups }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(productId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate/30 text-left text-slate">
        <tr>
          <th className="py-3 px-4 w-10"></th>
          <th className="py-3 px-4">SKU</th>
          <th className="py-3 px-4">Requests</th>
          <th className="py-3 px-4">Status</th>
          <th className="py-3 px-4">Earliest</th>
          <th className="py-3 px-4 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <GroupRows key={g.product_id} group={g} expanded={expanded.has(g.product_id)} onToggle={() => toggle(g.product_id)} />
        ))}
      </tbody>
    </table>
  );
}

function GroupRows({
  group,
  expanded,
  onToggle,
}: {
  group: InboundNominationGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-slate/10 bg-light-gray/50">
        <td className="py-3 px-4">
          <button
            type="button"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.sku_label}`}
            onClick={onToggle}
            className="text-slate hover:text-navy"
          >
            {expanded ? '▾' : '▸'}
          </button>
        </td>
        <td className="py-3 px-4 font-medium text-navy">{group.sku_label}</td>
        <td className="py-3 px-4">{group.request_count}</td>
        <td className="py-3 px-4">{formatStatusMix(group.status_mix)}</td>
        <td className="py-3 px-4">{new Date(group.earliest_arrival).toLocaleString()}</td>
        <td className="py-3 px-4 text-right text-slate">—</td>
      </tr>
      {expanded &&
        group.observers.map((o) => (
          <tr key={o.obligation_id} className="border-b border-slate/5">
            <td></td>
            <td className="py-2 pl-8 pr-4 text-slate">↳ <span>{o.observer_display_name}</span></td>
            <td className="py-2 px-4 text-slate">{o.status}</td>
            <td className="py-2 px-4 text-slate">{new Date(o.arrival_time).toLocaleString()}</td>
            <td className="py-2 px-4 text-slate">{o.resolution_class}</td>
            <td className="py-2 px-4 text-right text-slate">—</td>
          </tr>
        ))}
    </>
  );
}
