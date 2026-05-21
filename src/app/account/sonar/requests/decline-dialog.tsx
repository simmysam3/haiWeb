'use client';

import { useEffect, useRef, useState } from 'react';

interface DeclineDialogProps {
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
 * fixed inset overlay, navy/40 backdrop, click-outside-to-close, centered card,
 * document-level Escape listener, inline error feedback on submit failure.
 * Input/button styling mirrors the v1.34 working-list acknowledge-suppress
 * popover (slate/30 borders, teal solid for primary action).
 *
 * Props:
 * - `endpoint`: BFF POST route (item identity is encoded in the URL).
 * - `open` / `onClose`: dialog visibility wiring.
 * - `onComplete`: invoked on a 2xx response; parent is responsible for both
 *   refresh and close (Task 24 consumer concern).
 */
export function DeclineDialog({ endpoint, open, onClose, onComplete }: DeclineDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  if (!open) return null;

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      if (!res.ok) {
        setError(`Decline failed (${res.status}). Please try again.`);
        return;
      }
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Decline request"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40"
      onClick={onClose}
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
            ref={textareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Not our product line, Cannot disclose sub-tier"
            maxLength={2000}
            rows={4}
            className="w-full rounded-md border border-slate/30 px-3 py-2 text-sm text-charcoal placeholder:text-slate/60 focus:border-teal focus:outline-none"
          />
          <p className="text-xs text-slate">Vendor will see this reason.</p>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
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
