'use client';
import { useState } from 'react';

export interface AnnotationTarget {
  vendor: string; componentRef: string; depth: number;
}

export function AnnotationDrawer({
  draftId, target, existing, onClose, onSaved,
}: {
  draftId: string;
  target: AnnotationTarget;
  existing: { annotation_id: string; narrative: string; attachment_uri: string | null; attachment_hash: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [narrative, setNarrative] = useState(existing?.narrative ?? '');
  const [attachmentUri, setAttachmentUri] = useState(existing?.attachment_uri ?? '');
  const [attachmentHash, setAttachmentHash] = useState(existing?.attachment_hash ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const base = `/api/account/sonar/compliance/evidence/draft/${draftId}/annotations`;
      const body: Record<string, unknown> = { narrative };
      if (attachmentUri) body.attachment_uri = attachmentUri;
      if (attachmentHash) body.attachment_hash = attachmentHash;
      const res = existing
        ? await fetch(`${base}/${existing.annotation_id}`, {
            method: 'PATCH', headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch(base, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              ...body,
              target_vendor_participant_id: target.vendor,
              target_component_ref: target.componentRef,
              target_depth: target.depth,
            }),
          });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? `request failed (${res.status})`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save annotation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="fixed right-0 top-0 h-full w-[420px] bg-white border-l border-slate/15 p-5 shadow-xl overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-charcoal">{existing ? 'Edit annotation' : 'Annotate node'}</h3>
        <button type="button" onClick={onClose} className="text-slate">✕</button>
      </div>
      <label className="block text-xs text-slate mb-1">Narrative (required, ≤4096)</label>
      <textarea
        value={narrative} maxLength={4096}
        onChange={(e) => setNarrative(e.target.value)}
        className="w-full h-40 border border-slate/15 rounded p-2 text-sm"
      />
      <div className="text-[10px] text-slate text-right">{narrative.length}/4096</div>
      <label className="block text-xs text-slate mb-1 mt-2">Attachment URI (optional)</label>
      <input
        value={attachmentUri}
        onChange={(e) => setAttachmentUri(e.target.value)}
        className="w-full border border-slate/15 rounded p-2 text-sm"
      />
      <label className="block text-xs text-slate mb-1 mt-2">Attachment SHA-256 (optional, 64 hex)</label>
      <input
        value={attachmentHash}
        onChange={(e) => setAttachmentHash(e.target.value)}
        className="w-full border border-slate/15 rounded p-2 text-sm"
      />
      {error && <p className="text-problem text-xs mt-2">{error}</p>}
      <button
        type="button" disabled={busy || narrative.trim().length === 0}
        onClick={save}
        className="mt-4 w-full bg-charcoal text-white rounded py-2 text-sm disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
    </aside>
  );
}
