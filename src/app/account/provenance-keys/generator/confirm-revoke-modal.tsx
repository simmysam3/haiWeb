'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { mapProvenanceError } from '@/lib/provenance-key-errors';
import type { ProvenanceKeyWithCounts } from '@haiwave/protocol';

export interface ConfirmRevokeModalProps {
  keyRow: ProvenanceKeyWithCounts;
  open: boolean;
  onClose: () => void;
  onRevoked: () => void;
}

export function ConfirmRevokeModal({ keyRow, open, onClose, onRevoked }: ConfirmRevokeModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = confirmText.trim() === keyRow.friendly_name;

  async function handleRevoke() {
    if (!confirmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/provenance-keys/${keyRow.key_id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(mapProvenanceError(err));
        return;
      }
      onRevoked();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Revoke Key" width="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-charcoal">
          Revoking is permanent. All active installations will be cascade-removed the next time they validate the key.
        </p>
        <div>
          <label htmlFor="revoke-confirm" className="block text-sm font-medium text-charcoal mb-1">
            Type <strong className="font-mono">{keyRow.friendly_name}</strong> to confirm
          </label>
          <input
            id="revoke-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded border border-slate/30 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-[#B3261E]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate/30 px-4 py-2 text-sm text-charcoal"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={!confirmed || submitting}
            className="rounded bg-[#B3261E] hover:opacity-90 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Revoking\u2026' : 'Revoke'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
