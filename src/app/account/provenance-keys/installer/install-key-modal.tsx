'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { mapProvenanceError } from '@/lib/provenance-key-errors';
import type { InstallationPreview } from '@haiwave/protocol';

// Local extension: the generator-side ProvenanceKey carries policy_url (Task 9),
// but InstallationPreview in the protocol does not surface it yet. Read it
// defensively so the install UI renders the link when the BFF/core starts
// propagating it.
type InstallationPreviewWithPolicy = InstallationPreview & {
  policy_url?: string | null;
};

export interface InstallKeyModalProps {
  open: boolean;
  onClose: () => void;
  onInstalled: () => void;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function InstallKeyModal({ open, onClose, onInstalled }: InstallKeyModalProps) {
  const [pasted, setPasted] = useState('');
  const [preview, setPreview] = useState<InstallationPreviewWithPolicy | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setPreviewing(true);
    setError(null);
    try {
      const hash = await sha256Hex(pasted.trim());
      const res = await fetch('/api/account/provenance-keys/installations/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_hash: hash }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(mapProvenanceError(err));
        return;
      }
      setPreview((await res.json()) as InstallationPreviewWithPolicy);
    } finally {
      setPreviewing(false);
    }
  }

  const missingRequired = preview
    ? preview.required_fields.filter((f) => !f.shareable).map((f) => f.field)
    : [];
  const canInstall = preview !== null && missingRequired.length === 0;

  async function handleInstall() {
    if (!preview) return;
    setInstalling(true);
    setError(null);
    try {
      const hash = await sha256Hex(pasted.trim());
      // Accept only shareable requested fields by default.
      // The shareability gate is UI-only: InstallationCreationRequestSchema only
      // accepts accepted_requested_fields — there is no accepted_required_fields param.
      const acceptedRequested = preview.requested_fields
        .filter((f) => f.shareable)
        .map((f) => f.field);
      const res = await fetch('/api/account/provenance-keys/installations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_hash: hash, accepted_requested_fields: acceptedRequested }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(mapProvenanceError(err));
        return;
      }
      onInstalled();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Install Key" width="max-w-2xl">
      <div className="space-y-4">
        <form onSubmit={handlePreview} className="space-y-2">
          <label htmlFor="install-paste" className="block text-sm font-medium text-charcoal">
            Paste key
          </label>
          <input
            id="install-paste"
            type="text"
            autoComplete="off"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            className="w-full rounded border border-slate/30 px-3 py-2 text-sm font-mono"
          />
          <button
            type="submit"
            disabled={!pasted.trim() || previewing}
            className="rounded bg-teal hover:bg-teal-dark text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {previewing ? 'Previewing\u2026' : 'Preview'}
          </button>
        </form>

        {preview && (
          <div className="space-y-2 rounded border border-slate/20 p-3">
            <p className="text-sm text-charcoal">
              <strong>{preview.generator_legal_name}</strong> — {preview.friendly_name}
            </p>
            {preview.policy_url && (
              <div className="mb-3 rounded bg-slate/5 p-3">
                <a
                  href={preview.policy_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal font-medium underline"
                >
                  View vendor policy →
                </a>
                <p className="text-xs text-slate mt-1">
                  Review the policy document before accepting — installing this key binds you to its disclosure terms.
                </p>
              </div>
            )}
            <ul className="text-sm">
              {preview.required_fields.map((f) => (
                <li key={f.field} className="font-mono text-xs">
                  {f.field} {f.shareable ? '\u2713 shareable' : '\u2717 missing from your sharing policy'}
                </li>
              ))}
            </ul>
            {missingRequired.length > 0 && (
              <p className="text-sm text-[#B3261E]">
                Cannot install: widen your sharing policy to cover {missingRequired.join(', ')} first.
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
            type="button"
            onClick={handleInstall}
            disabled={!canInstall || installing}
            className="rounded bg-teal hover:bg-teal-dark text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {installing ? 'Installing\u2026' : 'Install'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
