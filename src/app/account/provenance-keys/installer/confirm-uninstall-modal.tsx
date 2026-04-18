'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { mapProvenanceError } from '@/lib/provenance-key-errors';

export interface ConfirmUninstallModalProps {
  installationId: string;
  open: boolean;
  onClose: () => void;
  onUninstalled: () => void;
}

export function ConfirmUninstallModal({
  installationId,
  open,
  onClose,
  onUninstalled,
}: ConfirmUninstallModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUninstall() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/account/provenance-keys/installations/${installationId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(mapProvenanceError(err));
        return;
      }
      onUninstalled();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Uninstall Key" width="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-charcoal">
          Uninstalling removes this installation. You can reinstall later using the same key value.
        </p>
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
            onClick={handleUninstall}
            disabled={submitting}
            className="rounded bg-[#B3261E] hover:opacity-90 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Uninstalling\u2026' : 'Uninstall'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
