'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { PermissionFieldChecklist } from '../_shared/permission-field-checklist';
import { mapProvenanceError } from '@/lib/provenance-key-errors';
import type {
  PermissionField,
  ProvenanceKeyWithCounts,
  ProvenanceKeyInstallation,
} from '@haiwave/protocol';

export interface EditPermissionsModalProps {
  keyRow: ProvenanceKeyWithCounts;
  installations: ProvenanceKeyInstallation[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditPermissionsModal({
  keyRow,
  installations,
  open,
  onClose,
  onSaved,
}: EditPermissionsModalProps) {
  const [required, setRequired] = useState<PermissionField[]>(keyRow.required_fields as PermissionField[]);
  const [requested, setRequested] = useState<PermissionField[]>(keyRow.requested_fields as PermissionField[]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originalRequired = new Set(keyRow.required_fields);
  const addedRequired = required.filter((f) => !originalRequired.has(f));

  const graceAffected = installations.filter((i) => {
    const accepted = new Set(i.accepted_required_fields);
    return addedRequired.some((f) => !accepted.has(f));
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/provenance-keys/${keyRow.key_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required_fields: required, requested_fields: requested }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(mapProvenanceError(err));
        return;
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Permissions" width="max-w-2xl">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-charcoal mb-2">Required fields</h4>
          <PermissionFieldChecklist value={required} onChange={setRequired} readOnly={requested} />
        </div>
        <div>
          <h4 className="text-sm font-medium text-charcoal mb-2">Requested fields</h4>
          <PermissionFieldChecklist value={requested} onChange={setRequested} readOnly={required} />
        </div>
        {addedRequired.length > 0 && (
          <div className="rounded border border-orange/40 bg-orange/10 p-3 text-sm">
            <strong className="text-charcoal">
              Starts 14-day grace for {graceAffected.length} installation{graceAffected.length === 1 ? '' : 's'}.
            </strong>
            {graceAffected.length > 0 && (
              <p className="text-slate mt-1">
                Missing field{addedRequired.length === 1 ? '' : 's'}: {addedRequired.join(', ')}
              </p>
            )}
          </div>
        )}
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
            type="submit"
            disabled={submitting}
            className="rounded bg-teal hover:bg-teal-dark text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
