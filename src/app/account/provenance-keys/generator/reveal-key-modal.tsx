'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';

export interface RevealKeyModalProps {
  open: boolean;
  onClose: () => void;
  keyId?: string;
  keyValue?: string;
}

export function RevealKeyModal({ open, onClose, keyId, keyValue }: RevealKeyModalProps) {
  const [value, setValue] = useState<string | null>(keyValue ?? null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (value) return;
    if (!keyId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/account/provenance-keys/${keyId}/value`);
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { key_value: string };
          setValue(body.key_value);
        }
      } catch {
        // fallback handled by empty state below
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, keyId, value]);

  async function handleCopy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal open={open} onClose={onClose} title="Key Value" width="max-w-2xl">
      <div className="space-y-3">
        <p className="text-sm text-slate">
          Copy the key now. You can reshow it any time, but treat it like a password.
        </p>
        {value ? (
          <code className="block w-full rounded bg-navy/5 p-3 font-mono text-xs break-all">
            {value}
          </code>
        ) : (
          <p className="text-sm text-slate italic">Raw value unavailable for this key.</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!value}
            className="rounded bg-teal hover:bg-teal-dark text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {copied ? 'Copied \u2713' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate/30 px-4 py-2 text-sm text-charcoal"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
