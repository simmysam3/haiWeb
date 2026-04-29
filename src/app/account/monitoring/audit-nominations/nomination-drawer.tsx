'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { InboundNominationRow } from './_lib/types';
import { NotesModal } from './notes-modal';

interface Props {
  row: InboundNominationRow;
  onClose: () => void;
}

interface ActionError {
  code?: string;
  message: string;
}

const ERROR_COPY: Record<string, string> = {
  OBLIGATION_ALREADY_TERMINAL: "This obligation is already in a final state and can't be changed.",
  OBLIGATION_NOT_FOUND: 'This nomination has been removed. Refresh to update the list.',
};

export function NominationDrawer({ row, onClose }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [modal, setModal] = useState<'defer' | 'decline' | null>(null);

  useEffect(() => {
    fetch(`/api/account/sku-obligations/${row.obligation_id}`).catch(() => {
      // Best-effort fresh fetch; row data is the synchronous fallback.
    });
  }, [row.obligation_id]);

  async function performAction(action: 'acknowledge' | 'decline' | 'defer', notes?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/account/sku-obligations/${row.obligation_id}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notes ? { notes } : {}),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: ActionError };
        const code = body.error?.code;
        setError({
          code,
          message: code && ERROR_COPY[code] ? ERROR_COPY[code] : body.error?.message ?? 'Request failed.',
        });
        return;
      }
      setModal(null);
      onClose();
      router.refresh();
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Network error.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <aside className="fixed inset-y-0 right-0 z-40 w-[420px] bg-white border-l border-slate/20 shadow-xl p-6 flex flex-col gap-4">
        <header className="flex items-start justify-between border-b border-slate/10 pb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate">{row.status}</p>
            <h2 className="text-xl font-display text-navy">{row.observer_display_name} · {row.sku_label}</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-slate hover:text-navy">
            ×
          </button>
        </header>

        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-slate">Arrived</dt>
          <dd className="text-navy">{new Date(row.arrival_time).toLocaleString()}</dd>
          <dt className="text-slate">Resolution class</dt>
          <dd className="text-navy">{row.resolution_class}</dd>
          <dt className="text-slate">Unresolved sub-tier</dt>
          <dd className="text-navy">{row.unresolved_subtier_count}</dd>
        </dl>

        <section className="rounded-md border border-dashed border-slate/30 bg-light-gray/50 p-3 text-xs text-slate">
          Manifest evaluation: compliance-reserved — populated in a future release.
        </section>

        {error && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {error.message}
          </div>
        )}

        <footer className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => performAction('acknowledge')}
            className="rounded-md bg-teal px-4 py-2 text-white hover:bg-teal/90 disabled:opacity-50"
          >
            {busy ? 'Accepting…' : 'Accept'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setModal('defer')}
            className="rounded-md border border-slate/30 px-4 py-2 text-slate hover:bg-light-gray/40 disabled:opacity-50"
          >
            Defer
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setModal('decline')}
            className="rounded-md border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Decline
          </button>
        </footer>
      </aside>
      {modal && (
        <NotesModal
          action={modal}
          context={`${row.observer_display_name} · ${row.sku_label}`}
          busy={busy}
          onCancel={() => setModal(null)}
          onConfirm={(notes) => performAction(modal, notes)}
        />
      )}
    </>
  );
}
