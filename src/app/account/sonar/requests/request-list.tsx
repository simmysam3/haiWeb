'use client';

import type { RequestManagementItem } from '@haiwave/protocol';
import { RequestRow } from './request-row';

/**
 * v1.35 Request Management — table of Request Management items.
 *
 * Renders a flat table (no partner-grouping; the orchestrator owns filtering
 * including counterparty filter). Empty state mirrors the working-list and
 * other compliance-surface empty messages: a single muted line.
 *
 * Styling intentionally mirrors the working-list table surface: slate/10
 * row dividers, slate/5 header band, uppercase tracking-wider column labels.
 */
interface RequestListProps {
  items: RequestManagementItem[];
  onMutate: () => void;
}

export function RequestList({ items, onMutate }: RequestListProps) {
  if (items.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-slate">No items match your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate/5 text-xs uppercase tracking-wider text-slate">
            <th scope="col" className="px-4 py-2 font-medium">Counterparty</th>
            <th scope="col" className="px-4 py-2 font-medium">Subject</th>
            <th scope="col" className="px-4 py-2 font-medium">Type</th>
            <th scope="col" className="px-4 py-2 font-medium">Age</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            // v1.36 protocol 3.11.0: discriminated union — narrow on item_type
            // to read the type-specific id. Composite key form (`type:id`)
            // keeps keys distinct across the (admittedly impossible)
            // collision case where a scope_id and an obligation_id share
            // the same UUID.
            const itemKey =
              item.item_type === 'inbound_obligation'
                ? `obligation:${item.obligation_id}`
                : `scope:${item.scope_id}`;
            return <RequestRow key={itemKey} item={item} onMutate={onMutate} />;
          })}
        </tbody>
      </table>
    </div>
  );
}
