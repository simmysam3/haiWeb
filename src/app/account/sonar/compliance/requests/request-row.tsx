'use client';

import { useState } from 'react';
import type { RequestManagementItem } from '@haiwave/protocol';
import { Pill } from '@/components/pill';
import { DeclineDialog } from './decline-dialog';

/**
 * v1.35 Request Management — single row in the unified Request Management list.
 *
 * Renders one inbound nomination / outbound nomination / inbound obligation as
 * a table row. Action buttons are direction-gated:
 * - `awaiting_me` items (inbound_nomination, inbound_obligation) → Accept | Decline
 * - `awaiting_them` outbound_nomination → Withdraw (initiator-side action)
 * - `awaiting_them` inbound_obligation → no actions (responder has acknowledged
 *   and is now working it; we don't surface an action here)
 *
 * Endpoint routing per item_type:
 * - inbound_obligation → /requests/obligations/:id/{accept,decline}
 * - inbound_nomination / outbound_nomination → /requests/scopes/:id/{accept,decline,withdraw}
 *
 * Fire-and-forget: Accept and Withdraw POST `{}` with content-type JSON, no
 * error UI; the orchestrator's SWR poll surfaces authoritative state after
 * `onMutate()`. Decline routes through `DeclineDialog` which captures an
 * optional cross-org-visible reason (Task 22) and owns its own error surface.
 *
 * Styling mirrors the v1.34 working-list action surface — outline buttons for
 * secondary actions (Decline / Withdraw), teal solid for the primary Accept
 * action (matches `decline-dialog.tsx` submit button and other primary CTAs).
 */
interface RequestRowProps {
  item: RequestManagementItem;
  onMutate: () => void;
}

export function RequestRow({ item, onMutate }: RequestRowProps) {
  const [declineOpen, setDeclineOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isObligation = item.item_type === 'inbound_obligation';
  const basePath = isObligation
    ? `/api/sonar/compliance/requests/obligations/${item.item_id}`
    : `/api/sonar/compliance/requests/scopes/${item.item_id}`;
  const acceptEndpoint = `${basePath}/accept`;
  const declineEndpoint = `${basePath}/decline`;
  const withdrawEndpoint = `/api/sonar/compliance/requests/scopes/${item.item_id}/withdraw`;

  async function fireAndForget(endpoint: string) {
    setBusy(true);
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      onMutate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-slate/10">
      <td className="px-4 py-3 text-sm text-navy">
        {item.counterparty_legal_name ?? item.counterparty_id}
      </td>
      <td className="px-4 py-3 text-sm text-charcoal">{item.subject}</td>
      <td className="px-4 py-3">
        <Pill category="request-type" value={item.item_type} />
      </td>
      <td className="px-4 py-3 text-xs text-slate">{item.age_days}d</td>
      <td className="px-4 py-3">
        <div className="flex shrink-0 items-center justify-end gap-2">
          {item.direction === 'awaiting_me' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => fireAndForget(acceptEndpoint)}
                className="rounded-md bg-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-teal/90 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeclineOpen(true)}
                className="rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal hover:text-navy disabled:opacity-50"
              >
                Decline
              </button>
            </>
          )}
          {item.direction === 'awaiting_them' &&
            item.item_type === 'outbound_nomination' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => fireAndForget(withdrawEndpoint)}
                className="rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal hover:text-navy disabled:opacity-50"
              >
                Withdraw
              </button>
            )}
        </div>
        <DeclineDialog
          endpoint={declineEndpoint}
          open={declineOpen}
          onClose={() => setDeclineOpen(false)}
          onComplete={() => {
            setDeclineOpen(false);
            onMutate();
          }}
        />
      </td>
    </tr>
  );
}
