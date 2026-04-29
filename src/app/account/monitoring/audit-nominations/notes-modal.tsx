'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';

interface Props {
  action: 'defer' | 'decline';
  context: string;
  onConfirm: (notes: string | undefined) => Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

const TITLES = { defer: 'Defer nomination', decline: 'Decline nomination' };

export function NotesModal({ action, context, onConfirm, onCancel, busy }: Props) {
  const [notes, setNotes] = useState('');
  const trimmed = notes.trim();

  return (
    <Modal open onClose={onCancel} title={TITLES[action]} width="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-slate">{context}</p>
        {action === 'decline' && (
          <p className="rounded-md bg-light-gray/60 p-3 text-xs text-slate">
            This is informational. The observer sees the obligation status update;
            this is not a contractual rejection.
          </p>
        )}
        <textarea
          className="w-full rounded-md border border-slate/30 p-2 text-sm"
          rows={3}
          placeholder="Optional notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate/30 px-4 py-2 text-sm text-slate hover:bg-light-gray/40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(trimmed ? trimmed : undefined)}
            className="rounded-md bg-navy px-4 py-2 text-sm text-white hover:bg-navy/90 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
