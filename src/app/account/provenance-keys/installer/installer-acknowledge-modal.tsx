'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { mapProvenanceError } from '@/lib/provenance-key-errors';
import type { ProvenanceKeyInstallation, SharingPolicy } from '@haiwave/protocol';

export interface InstallerAcknowledgeModalProps {
  installation: ProvenanceKeyInstallation;
  sharingPolicy: SharingPolicy;
  open: boolean;
  onClose: () => void;
  onAcknowledged: () => void;
}

export function InstallerAcknowledgeModal({
  installation,
  sharingPolicy,
  open,
  onClose,
  onAcknowledged,
}: InstallerAcknowledgeModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = installation.compliance.missing_fields;
  const shared = new Set(sharingPolicy.shared_fields);
  const needsPolicyWiden = missing.filter((f) => !shared.has(f));

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      // Step 1: Widen sharing policy if needed.
      if (needsPolicyWiden.length > 0) {
        const nextShared = [...sharingPolicy.shared_fields, ...needsPolicyWiden];
        const polRes = await fetch('/api/account/sharing-policy', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shared_fields: nextShared }),
        });
        if (!polRes.ok) {
          const err = await polRes.json().catch(() => ({}));
          setError(mapProvenanceError(err));
          return;
        }
      }

      // Step 2: PATCH the installation to acknowledge the new required fields.
      // NOTE (v.1.24 scope): InstallationPatchSchema currently only accepts
      // `accepted_requested_fields`. If the backend rejects `accepted_required_fields`
      // with INVALID_REQUEST, the sharing-policy widening above has already succeeded
      // (not rolled back). The dashboard will still show grace_pending on next load —
      // this is the §5 F4 fallback. Surface the error inline so the user can retry
      // or contact support. A future protocol update should add accepted_required_fields
      // to InstallationPatchSchema to close this gap.
      const instRes = await fetch(
        `/api/account/provenance-keys/installations/${installation.installation_id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accepted_requested_fields: installation.accepted_requested_fields,
          }),
        },
      );
      if (!instRes.ok) {
        const err = await instRes.json().catch(() => ({}));
        setError(mapProvenanceError(err));
        return;
      }
      onAcknowledged();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Review & Acknowledge" width="max-w-lg">
      <div className="space-y-4">
        {step === 1 ? (
          <>
            <p className="text-sm text-charcoal">
              The generator now requires{' '}
              <span className="font-mono text-xs">{missing.join(', ')}</span>.
            </p>
            {needsPolicyWiden.length > 0 && (
              <p className="text-sm text-charcoal">
                Your sharing policy does not currently cover{' '}
                <span className="font-mono text-xs">{needsPolicyWiden.join(', ')}</span>.
                Acknowledging will widen your sharing policy AND accept these fields for this
                installation.
              </p>
            )}
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
                onClick={() => setStep(2)}
                className="rounded bg-teal hover:bg-teal-dark text-white px-4 py-2 text-sm font-medium"
              >
                Next: Review
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-charcoal">
              Confirm sharing{' '}
              <span className="font-mono text-xs">{missing.join(', ')}</span> with this generator.
            </p>
            {error && <p className="text-sm text-[#B3261E]">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded border border-slate/30 px-4 py-2 text-sm text-charcoal"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="rounded bg-teal hover:bg-teal-dark text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Confirming\u2026' : 'Confirm share + accept'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
