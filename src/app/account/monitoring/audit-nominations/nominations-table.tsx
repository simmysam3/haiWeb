'use client';

import { useState } from 'react';
import type { InboundNominationGroup } from './_lib/types';
import { formatStatusMix } from './_lib/format-status-mix';
import { NominationDrawer } from './nomination-drawer';
import type { InboundNominationRow } from './_lib/types';
import { BulkActionModal } from './bulk-action-modal';

interface Props {
  groups: InboundNominationGroup[];
}

export function NominationsTable({ groups }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drawerRow, setDrawerRow] = useState<InboundNominationRow | null>(null);
  const [bulk, setBulk] = useState<{ action: 'acknowledge' | 'defer' | 'decline'; group: InboundNominationGroup } | null>(null);

  function toggle(productId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  return (
    <>
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
            <GroupRows
              key={g.product_id}
              group={g}
              expanded={expanded.has(g.product_id)}
              onToggle={() => toggle(g.product_id)}
              onObserverClick={setDrawerRow}
              onBulkAction={(action) => setBulk({ action, group: g })}
            />
          ))}
        </tbody>
      </table>
      {drawerRow && <NominationDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />}
      {bulk && (
        <BulkActionModal
          action={bulk.action}
          sku_label={bulk.group.sku_label}
          observers={bulk.group.observers.map((o) => ({
            obligation_id: o.obligation_id,
            display_name: o.observer_display_name,
          }))}
          onClose={() => setBulk(null)}
        />
      )}
    </>
  );
}

function GroupRows({
  group,
  expanded,
  onToggle,
  onObserverClick,
  onBulkAction,
}: {
  group: InboundNominationGroup;
  expanded: boolean;
  onToggle: () => void;
  onObserverClick: (row: InboundNominationRow) => void;
  onBulkAction: (action: 'acknowledge' | 'defer' | 'decline') => void;
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
        <td className="py-3 px-4 text-right">
          <div className="inline-flex gap-2">
            <button
              type="button"
              onClick={() => onBulkAction('acknowledge')}
              className="rounded border border-teal px-2 py-1 text-xs text-teal hover:bg-teal/10"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={() => onBulkAction('defer')}
              className="rounded border border-slate/30 px-2 py-1 text-xs text-slate hover:bg-light-gray/40"
            >
              Defer all
            </button>
            <button
              type="button"
              onClick={() => onBulkAction('decline')}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Decline all
            </button>
          </div>
        </td>
      </tr>
      {expanded &&
        group.observers.map((o) => (
          <tr key={o.obligation_id} className="border-b border-slate/5">
            <td></td>
            <td className="py-2 pl-8 pr-4 text-slate">↳ <span>{o.observer_display_name}</span></td>
            <td className="py-2 px-4 text-slate">{o.status}</td>
            <td className="py-2 px-4 text-slate">{new Date(o.arrival_time).toLocaleString()}</td>
            <td className="py-2 px-4 text-slate">{o.resolution_class}</td>
            <td className="py-2 px-4 text-right">
              <button
                type="button"
                aria-label={`Open detail for ${o.observer_display_name} on ${o.sku_label}`}
                onClick={() => onObserverClick(o)}
                className="text-teal hover:underline"
              >
                Review →
              </button>
            </td>
          </tr>
        ))}
    </>
  );
}
