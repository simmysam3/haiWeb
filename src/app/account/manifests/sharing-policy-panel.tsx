'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { PermissionFieldChecklist } from '../provenance-keys/_shared/permission-field-checklist';
import { mapProvenanceError } from '@/lib/provenance-key-errors';
import type { PermissionField, SharingPolicyUpdateResponse } from '@haiwave/protocol';

export function SharingPolicyPanel() {
  const [initial, setInitial] = useState<PermissionField[]>([]);
  const [draft, setDraft] = useState<PermissionField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<SharingPolicyUpdateResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/account/sharing-policy');
      if (res.ok) {
        const body = (await res.json()) as { shared_fields: PermissionField[] };
        setInitial(body.shared_fields);
        setDraft(body.shared_fields);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/account/sharing-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared_fields: draft, dry_run: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(mapProvenanceError(err));
        return;
      }
      const preview = (await res.json()) as SharingPolicyUpdateResponse;
      if (preview.warnings.length > 0) {
        setConfirmModal(preview);
      } else {
        await commit();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function commit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/account/sharing-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared_fields: draft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(mapProvenanceError(err));
        return;
      }
      const body = (await res.json()) as SharingPolicyUpdateResponse;
      setInitial(body.policy.shared_fields);
      setDraft(body.policy.shared_fields);
      setConfirmModal(null);
      setToast(
        body.warnings.length > 0
          ? `Policy updated. ${body.warnings.length} installation${body.warnings.length === 1 ? '' : 's'} now non-compliant.`
          : 'Policy updated.',
      );
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-slate">Loading…</p>;

  const dirty = JSON.stringify([...initial].sort()) !== JSON.stringify([...draft].sort());

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate">
        Control which fields your agent is allowed to share when responding to provenance-key
        traversals. Narrowing this list may leave active installations non-compliant.
      </p>
      <form onSubmit={handleSave} className="space-y-4">
        <PermissionFieldChecklist value={draft} onChange={setDraft} />
        {error && <p className="text-sm text-[#B3261E]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDraft(initial)}
            disabled={!dirty || submitting}
            className="rounded border border-slate/30 px-4 py-2 text-sm text-charcoal disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={!dirty || submitting}
            className="rounded bg-teal hover:bg-teal-dark text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {toast && (
        <div className="fixed bottom-4 right-4 rounded bg-navy text-white px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}

      {confirmModal && (
        <Modal
          open={true}
          onClose={() => setConfirmModal(null)}
          title="Confirm narrow"
          width="max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-charcoal">
              This will make{' '}
              <strong>
                {confirmModal.warnings.length} installation
                {confirmModal.warnings.length === 1 ? '' : 's'}
              </strong>{' '}
              non-compliant. The installations stay active — but the missing fields will stop
              flowing to those generators.
            </p>
            <ul className="space-y-1 text-sm text-slate max-h-48 overflow-auto">
              {confirmModal.warnings.map((w) => (
                <li key={w.installation_id} className="font-mono text-xs">
                  {w.installation_id.slice(0, 12)}… — missing {w.missing_fields.join(', ')}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="rounded border border-slate/30 px-4 py-2 text-sm text-charcoal"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commit}
                disabled={submitting}
                className="rounded bg-[#B3261E] hover:opacity-90 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Committing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
