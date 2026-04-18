'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { PermissionFieldChecklist } from '../_shared/permission-field-checklist';
import { mapProvenanceError } from '@/lib/provenance-key-errors';
import type { PermissionField, ProvenanceKeyCreationResponse } from '@haiwave/protocol';

export interface GenerateKeyModalProps {
  open: boolean;
  onClose: () => void;
  onGenerated: (result: ProvenanceKeyCreationResponse) => void;
}

export function GenerateKeyModal({ open, onClose, onGenerated }: GenerateKeyModalProps) {
  const [friendlyName, setFriendlyName] = useState('');
  const [required, setRequired] = useState<PermissionField[]>([]);
  const [requested, setRequested] = useState<PermissionField[]>([]);
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/account/provenance-keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendly_name: friendlyName,
          required_fields: required,
          requested_fields: requested,
          purpose: purpose || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(mapProvenanceError(err));
        return;
      }
      const body = (await res.json()) as ProvenanceKeyCreationResponse;
      onGenerated(body);
    } finally {
      setSubmitting(false);
    }
  }

  const requestedReadOnly = required; // prevent overlap selection

  return (
    <Modal open={open} onClose={onClose} title="Generate Provenance Key" width="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="gen-friendly-name" className="block text-sm font-medium text-charcoal mb-1">
            Friendly name
          </label>
          <input
            id="gen-friendly-name"
            type="text"
            required
            maxLength={128}
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
            className="w-full rounded border border-slate/30 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="gen-purpose" className="block text-sm font-medium text-charcoal mb-1">
            Purpose (optional)
          </label>
          <input
            id="gen-purpose"
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full rounded border border-slate/30 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <h4 className="text-sm font-medium text-charcoal mb-2">Required fields</h4>
          <PermissionFieldChecklist value={required} onChange={setRequired} />
        </div>
        <div>
          <h4 className="text-sm font-medium text-charcoal mb-2">
            Requested fields (optional, cannot overlap required)
          </h4>
          <PermissionFieldChecklist
            value={requested}
            onChange={setRequested}
            readOnly={requestedReadOnly}
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
            type="submit"
            disabled={submitting || !friendlyName.trim()}
            className="rounded bg-teal hover:bg-teal-dark text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Generating\u2026' : 'Generate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
