'use client';

import { useState } from 'react';

interface DeclineDialogProps {
  itemId: string;
  endpoint: string; // BFF route to POST
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * Reusable decline dialog for v1.35 Request Management scope + obligation rows.
 *
 * Captures an optional decline reason (max 2000 chars, matching protocol Zod
 * schema) and POSTs `{ reason }` (or `{}` when empty) to the supplied endpoint.
 * The reason is visible to the counterparty (cross-org visibility — Q7 R-4),
 * which is why the help text explicitly warns the user.
 *
 * Modal pattern mirrors `watcher/dashboard/_components/trigger-modal.tsx`:
 * fixed inset overlay, navy/40 backdrop, click-outside-to-close, centered card.
 * Input/button styling mirrors the v1.34 working-list acknowledge-suppress
 * popover (slate/30 borders, teal solid for primary action).
 */
export function DeclineDialog({ itemId, endpoint, open, onClose, onComplete }: DeclineDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      if (res.ok) onComplete();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Decline request"
      data-item-id={itemId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        className="bg-white rounded-md shadow-lg w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-navy">
          Decline
        </h3>
        <div className="space-y-1">
          <label htmlFor="decline-reason" className="block text-sm font-medium text-charcoal">
            Reason (optional)
          </label>
          <textarea
            id="decline-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Not our product line, Cannot disclose sub-tier"
            maxLength={2000}
            rows={4}
            className="w-full rounded-md border border-slate/30 px-3 py-2 text-sm text-charcoal placeholder:text-slate/60 focus:border-teal focus:outline-none"
          />
          <p className="text-xs text-slate">Vendor will see this reason.</p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-charcoal hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded bg-teal text-white px-4 py-1.5 text-sm font-medium hover:bg-teal/90 disabled:opacity-60"
          >
            {submitting ? 'Declining…' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}
