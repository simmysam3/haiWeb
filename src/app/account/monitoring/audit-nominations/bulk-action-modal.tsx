'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/modal';

type BulkAction = 'acknowledge' | 'defer' | 'decline';

const TITLES: Record<BulkAction, string> = {
  acknowledge: 'Accept',
  defer: 'Defer',
  decline: 'Decline',
};

interface Props {
  action: BulkAction;
  sku_label: string;
  observers: Array<{ obligation_id: string; display_name: string }>;
  onClose: () => void;
}

export function BulkActionModal({ action, sku_label, observers, onClose }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setResultMessage(null);
    const trimmed = notes.trim();
    const body = JSON.stringify(trimmed ? { notes: trimmed } : {});
    const results = await Promise.all(
      observers.map(async (o) => {
        try {
          const res = await fetch(
            `/api/account/sku-obligations/${o.obligation_id}/${action}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
          );
          return { id: o.obligation_id, name: o.display_name, ok: res.ok };
        } catch {
          return { id: o.obligation_id, name: o.display_name, ok: false };
        }
      }),
    );
    setBusy(false);

    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    if (failures.length === 0) {
      router.refresh();
      onClose();
      return;
    }
    if (successes.length === 0) {
      setResultMessage(`Couldn't ${TITLES[action].toLowerCase()} any nominations on ${sku_label}.`);
      return;
    }
    setResultMessage(
      `${TITLES[action]}ed ${successes.length} of ${results.length}; failed: ${failures.map((f) => f.name).join(', ')}.`,
    );
    router.refresh();
    onClose();
  }

  const title = `${TITLES[action]} ${observers.length} nomination${observers.length === 1 ? '' : 's'} on ${sku_label}`;

  return (
    <Modal open onClose={onClose} title={title} width="max-w-md">
      <div className="space-y-4">
        <ul className="list-disc pl-5 text-sm text-slate">
          {observers.map((o) => (
            <li key={o.obligation_id}>{o.display_name}</li>
          ))}
        </ul>
        {action === 'decline' && (
          <p className="rounded-md bg-light-gray/60 p-3 text-xs text-slate">
            This is informational. Each observer sees their obligation status update;
            this is not a contractual rejection.
          </p>
        )}
        {(action === 'defer' || action === 'decline') && (
          <textarea
            className="w-full rounded-md border border-slate/30 p-2 text-sm"
            rows={3}
            placeholder="Optional notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
        {resultMessage && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {resultMessage}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate/30 px-4 py-2 text-sm text-slate hover:bg-light-gray/40 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="rounded-md bg-navy px-4 py-2 text-sm text-white hover:bg-navy/90 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
