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
 * - inbound_obligation → /requests/obligations/:obligation_id/{accept,decline}
 * - inbound_nomination / outbound_nomination → /requests/scopes/:scope_id/{accept,decline,withdraw}
 *
 * v1.36 (protocol 3.11.0): RequestManagementItem is a discriminated union
 * over `item_type`. We narrow once and pull the type-specific id off the
 * matched branch (scope_id vs obligation_id).
 *
 * Accept and Withdraw POST `{}` with content-type JSON. On 2xx the
 * orchestrator's SWR poll surfaces authoritative state via `onMutate()`. On
 * non-2xx (or network failure) the row renders an inline error and does NOT
 * call `onMutate()` — mirrors the v1.34 working-list-table transition surface
 * (and DeclineDialog, which owns its own error surface for the reason flow).
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
  const [error, setError] = useState<string | null>(null);

  // Discriminated-union narrowing: the obligation branch carries
  // `obligation_id`; the nomination branches carry `scope_id`. The Withdraw
  // action is only valid on outbound_nomination, which is necessarily a
  // nomination branch (guarded by the render condition below).
  const basePath =
    item.item_type === 'inbound_obligation'
      ? `/api/sonar/compliance/requests/obligations/${item.obligation_id}`
      : `/api/sonar/compliance/requests/scopes/${item.scope_id}`;
  const acceptEndpoint = `${basePath}/accept`;
  const declineEndpoint = `${basePath}/decline`;

  async function postAction(endpoint: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setError(text || `Action failed (${res.status})`);
        return;
      }
      onMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
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
                onClick={() => postAction(acceptEndpoint)}
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
                onClick={() => postAction(`${basePath}/withdraw`)}
                className="rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal hover:text-navy disabled:opacity-50"
              >
                Withdraw
              </button>
            )}
        </div>
        {error && (
          <p role="alert" className="mt-1 text-sm text-rose-600">
            {error}
          </p>
        )}
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
