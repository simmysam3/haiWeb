'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/drawer';
import { ComplianceChip } from '../_shared/compliance-chip';
import type { ProvenanceKeyWithCounts, ProvenanceKeyInstallation } from '@haiwave/protocol';
import { EditPermissionsModal } from './edit-permissions-modal';
import { ConfirmRevokeModal } from './confirm-revoke-modal';
import { RevealKeyModal } from './reveal-key-modal';

export interface KeyDetailsDrawerProps {
  keyRow: ProvenanceKeyWithCounts;
  open: boolean;
  onClose: () => void;
  onKeyChanged: () => void;
}

export function KeyDetailsDrawer({ keyRow, open, onClose, onKeyChanged }: KeyDetailsDrawerProps) {
  const [installations, setInstallations] = useState<ProvenanceKeyInstallation[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const [showReveal, setShowReveal] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/account/provenance-keys/${keyRow.key_id}/installations`);
        if (cancelled) return;
        if (res.ok) {
          const json = (await res.json()) as { installations: ProvenanceKeyInstallation[] };
          setInstallations(json.installations ?? []);
        }
      } catch {
        // network unavailable (e.g. test environment with no base URL) — leave list empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, keyRow.key_id]);

  return (
    <Drawer open={open} onClose={onClose} title={keyRow.friendly_name} width="max-w-2xl">
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate">Fields</h3>
          <p className="text-sm text-charcoal">
            <strong>Required:</strong>{' '}
            <span className="font-mono text-xs">
              {keyRow.required_fields.length > 0 ? keyRow.required_fields.join(', ') : 'none'}
            </span>
          </p>
          <p className="text-sm text-charcoal">
            <strong>Requested:</strong>{' '}
            <span className="font-mono text-xs">
              {keyRow.requested_fields.length > 0 ? keyRow.requested_fields.join(', ') : 'none'}
            </span>
          </p>
        </section>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-teal hover:bg-teal-dark text-white px-4 py-2 text-sm font-medium"
            onClick={() => setShowReveal(true)}
          >
            Show key
          </button>
          <button
            type="button"
            className="rounded border border-slate/30 hover:border-charcoal text-charcoal px-4 py-2 text-sm font-medium"
            onClick={() => setShowEdit(true)}
          >
            Edit permissions
          </button>
          <button
            type="button"
            className="rounded border border-[#B3261E] text-[#B3261E] hover:bg-[#B3261E]/10 px-4 py-2 text-sm font-medium"
            onClick={() => setShowRevoke(true)}
          >
            Revoke
          </button>
        </div>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate">
            Installations ({installations.length})
          </h3>
          {installations.length === 0 ? (
            <p className="text-sm text-slate">No installations.</p>
          ) : (
            <ul className="space-y-2">
              {installations.map((i) => (
                <li
                  key={i.installation_id}
                  className="flex items-center justify-between border-b border-slate/10 py-2"
                >
                  <span className="font-mono text-xs text-charcoal">
                    {i.installer_participant_id.slice(0, 16)}…
                  </span>
                  <ComplianceChip compliance={i.compliance} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showEdit && (
        <EditPermissionsModal
          keyRow={keyRow}
          installations={installations}
          open={true}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            onKeyChanged();
          }}
        />
      )}
      {showRevoke && (
        <ConfirmRevokeModal
          keyRow={keyRow}
          open={true}
          onClose={() => setShowRevoke(false)}
          onRevoked={() => {
            setShowRevoke(false);
            onKeyChanged();
            onClose();
          }}
        />
      )}
      {showReveal && (
        <RevealKeyModal
          keyId={keyRow.key_id}
          open={true}
          onClose={() => setShowReveal(false)}
        />
      )}
    </Drawer>
  );
}
