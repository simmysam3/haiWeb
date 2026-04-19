'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Drawer } from '@/components/drawer';
import { ComplianceChip } from '../_shared/compliance-chip';
import type { ProvenanceKeyWithCounts, ProvenanceKeyInstallation } from '@haiwave/protocol';
import { EditPermissionsModal } from './edit-permissions-modal';
import { ConfirmRevokeModal } from './confirm-revoke-modal';
import { RevealKeyModal } from './reveal-key-modal';

type AuditEventRow = {
  id: string;
  event_type: string;
  actor_id: string;
  details?: Record<string, unknown> | null;
  timestamp: string;
};
type AuditPage = {
  events: AuditEventRow[];
  total: number;
  page: number;
  page_size: number;
};

const PAGE_SIZE = 25;

function renderAuditDetail(e: AuditEventRow): ReactNode {
  const details = e.details ?? {};
  if (
    e.event_type === 'provenance_key.required_fields_updated' ||
    e.event_type === 'provenance_key.requested_fields_updated'
  ) {
    const added = Array.isArray(details.added) ? (details.added as string[]) : [];
    const removed = Array.isArray(details.removed) ? (details.removed as string[]) : [];
    return (
      <span className="ml-2">
        {added.map((f) => (
          <span key={`+${f}`} className="ml-1 rounded bg-teal/10 px-1 font-mono text-teal">+{f}</span>
        ))}
        {removed.map((f) => (
          <span key={`-${f}`} className="ml-1 rounded bg-[#B3261E]/10 px-1 font-mono text-[#B3261E]">−{f}</span>
        ))}
      </span>
    );
  }
  if (Object.keys(details).length === 0) return null;
  return (
    <details className="ml-2 inline">
      <summary className="cursor-pointer text-slate">{'{…}'}</summary>
      <pre className="mt-1 overflow-auto rounded bg-slate/5 p-2 text-[10px]">
        {JSON.stringify(details, null, 2)}
      </pre>
    </details>
  );
}

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
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditData, setAuditData] = useState<AuditPage | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditKeyId, setAuditKeyId] = useState(keyRow.key_id);

  // Reset paging if the drawer switches keys (derived during render, not in effect).
  if (auditKeyId !== keyRow.key_id) {
    setAuditKeyId(keyRow.key_id);
    setAuditOpen(false);
    setAuditPage(1);
    setAuditData(null);
    setAuditError(null);
  }

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

  useEffect(() => {
    if (!auditOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ page: String(auditPage), page_size: String(PAGE_SIZE) });
        const res = await fetch(`/api/account/provenance-keys/${keyRow.key_id}/audit?${qs.toString()}`);
        if (cancelled) return;
        if (res.ok) {
          const json = (await res.json()) as AuditPage;
          setAuditData(json);
          setAuditError(null);
        } else {
          setAuditError(`Failed to load audit (${res.status})`);
        }
      } catch (err) {
        if (!cancelled) setAuditError(err instanceof Error ? err.message : 'Failed to load audit');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auditOpen, auditPage, keyRow.key_id]);


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

        <section className="space-y-2">
          <button
            type="button"
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate hover:text-charcoal"
            onClick={() => setAuditOpen((v) => !v)}
          >
            <span>
              Audit trail{auditData ? ` (${auditData.total})` : ''}
            </span>
            <span aria-hidden="true">{auditOpen ? '▾' : '▸'}</span>
          </button>

          {auditOpen && (
            <div className="space-y-2">
              {auditError && (
                <p className="text-sm text-[#B3261E]">{auditError}</p>
              )}
              {!auditError && !auditData && (
                <p className="text-sm text-slate">Loading…</p>
              )}
              {!auditError && auditData && auditData.events.length === 0 && (
                <p className="text-sm text-slate">No audit events.</p>
              )}
              {!auditError && auditData && auditData.events.length > 0 && (
                <ul className="space-y-1">
                  {auditData.events.map((e) => (
                    <li key={e.id} className="border-b border-slate/10 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{e.event_type}</span>
                        <span className="text-slate" title={new Date(e.timestamp).toLocaleString()}>
                          {e.timestamp}
                        </span>
                      </div>
                      <div className="mt-1 text-slate">
                        actor <span className="font-mono">{e.actor_id.slice(0, 8)}…</span>
                        {renderAuditDetail(e)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!auditError && auditData && auditData.total > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    disabled={auditPage <= 1}
                    className="rounded border border-slate/30 px-2 py-1 disabled:opacity-30"
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  >
                    ‹ Prev
                  </button>
                  <span>
                    Page {auditData.page} of {Math.max(1, Math.ceil(auditData.total / auditData.page_size))}
                  </span>
                  <button
                    type="button"
                    disabled={auditData.page * auditData.page_size >= auditData.total}
                    className="rounded border border-slate/30 px-2 py-1 disabled:opacity-30"
                    onClick={() => setAuditPage((p) => p + 1)}
                  >
                    Next ›
                  </button>
                </div>
              )}
            </div>
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
