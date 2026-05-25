'use client';

import type { RequestManagementItem } from '@haiwave/protocol';
import { Pill } from '@/components/pill';

/**
 * Read-only audit-trail table for declined items. Rendered by
 * `RequestManagementClient` when the Declined direction tab is active.
 *
 * Extracted from the standalone `/account/sonar/requests/declined` server
 * page when that route was collapsed into the unified `?direction=declined`
 * tab. Declined items cannot be un-declined — the counterparty would need
 * to re-nominate — so the table surfaces no row actions, mirroring the
 * v1.35 declined page.
 */
interface DeclinedListProps {
  items: RequestManagementItem[];
}

export function DeclinedList({ items }: DeclinedListProps) {
  if (items.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-slate">
          No requests have been declined in the last 30 days.
        </p>
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
            <th scope="col" className="px-4 py-2 font-medium">Reason</th>
            <th scope="col" className="px-4 py-2 font-medium">Declined</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const itemKey =
              item.item_type === 'inbound_obligation'
                ? `obligation:${item.obligation_id}`
                : `scope:${item.scope_id}`;
            return (
              <tr key={itemKey} className="border-t border-slate/10">
                <td className="px-4 py-3 text-sm text-navy">
                  {item.counterparty_legal_name ?? item.counterparty_id}
                </td>
                <td className="px-4 py-3 text-sm text-charcoal">{item.subject}</td>
                <td className="px-4 py-3">
                  <Pill category="request-type" value={item.item_type} />
                </td>
                <td className="px-4 py-3 text-sm text-slate">
                  {item.decision_reason ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate">
                  {new Date(item.created_at).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
