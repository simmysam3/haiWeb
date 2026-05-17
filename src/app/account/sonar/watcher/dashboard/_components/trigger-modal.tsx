'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SignalType } from '@haiwave/protocol';
import { SIGNAL_TYPE_LABELS } from '@/lib/signal-type-labels';

interface TriggerModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ALL_SIGNALS: { value: SignalType; label: string; description: string }[] = (
  Object.entries(SIGNAL_TYPE_LABELS) as [SignalType, { label: string; tooltip: string }][]
).map(([value, meta]) => ({ value, label: meta.label, description: meta.tooltip }));

/**
 * Modal for selecting which Watcher signals to fetch. Submitting POSTs to
 * /api/account/sonar/watcher/runs and closes on success. counterparty_filter
 * is omitted (= all tier-1 partners) for the v1.28 demo flow.
 */
export function TriggerModal({ onClose, onSuccess }: TriggerModalProps) {
  const [selected, setSelected] = useState<Set<SignalType>>(
    new Set(['lead_time_distribution']),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (signal: SignalType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(signal)) next.delete(signal);
      else next.add(signal);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) {
      setError('Pick at least one signal type.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/account/sonar/watcher/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signal_types: Array.from(selected) }),
      });
      if (!res.ok) {
        setError(`Trigger failed (${res.status}). Check server logs.`);
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trigger failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-md shadow-lg w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-navy">
          New Watcher observation
        </h3>
        <p className="text-sm text-slate">
          Pick the signal types to request from each tier-1 counterparty. The run
          dispatches asynchronously; status updates appear in run history.
        </p>
        <div className="space-y-2">
          {ALL_SIGNALS.map((signal) => (
            <label
              key={signal.value}
              className="flex items-start gap-3 rounded border border-slate-200 p-3 cursor-pointer hover:border-teal/60"
            >
              <input
                type="checkbox"
                checked={selected.has(signal.value)}
                onChange={() => toggle(signal.value)}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-charcoal">{signal.label}</div>
                <div className="text-xs text-slate">{signal.description}</div>
              </div>
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-between items-center gap-2">
          <Link
            href="/account/sonar/templates/new?observation_class=watcher"
            className="text-sm text-teal hover:underline"
            onClick={onClose}
          >
            Save as Watch instead
          </Link>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-charcoal hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded bg-teal text-white px-4 py-1.5 text-sm font-medium hover:bg-teal/90 disabled:opacity-60"
            >
              {busy ? 'Triggering…' : 'Run observation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
