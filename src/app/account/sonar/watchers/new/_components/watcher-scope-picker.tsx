'use client';

import { useEffect, useState } from 'react';
import type { SignalType, WatcherScope } from '@haiwave/protocol';
import { Pill } from '@/components/pill';
import { SIGNAL_TYPE_LABELS } from '@/lib/signal-type-labels';
import { BilateralCounterpartiesSkusFields } from '../../../_components/bilateral-counterparties-skus-fields';
import { SIGNAL_TYPE_ABBREVIATIONS } from '../../_lib/signal-type-abbreviations';

interface Props {
  value: WatcherScope;
  onChange: (next: WatcherScope) => void;
}

// Readiness watcher signals — the forward-looking provenance surface (published
// baseline, live capacity band, order-fulfillment history, and the soft-quoted
// phantom-demand traversal). Labels come from the shared signal-type-labels
// source of truth. The legacy lead-time distribution and delivery-event signals
// are no longer offered here — published/soft-quoted supersede them.
const SIGNAL_OPTIONS: { value: SignalType; label: string }[] = [
  { value: 'published_lead_time', label: SIGNAL_TYPE_LABELS.published_lead_time.label },
  { value: 'capacity_utilization_band', label: SIGNAL_TYPE_LABELS.capacity_utilization_band.label },
  { value: 'order_fulfillment_history', label: SIGNAL_TYPE_LABELS.order_fulfillment_history.label },
  { value: 'soft_quoted_lead_time', label: SIGNAL_TYPE_LABELS.soft_quoted_lead_time.label },
];

export function WatcherScopePicker({ value, onChange }: Props) {
  // Local mirror of depth_limit so the user can briefly clear the field (NaN)
  // while typing a new number. Only valid 1..8 integers propagate to onChange;
  // empty/out-of-range states stay local.
  const [depthDraft, setDepthDraft] = useState<string>(String(value.depth_limit));
  useEffect(() => {
    setDepthDraft(String(value.depth_limit));
  }, [value.depth_limit]);

  function toggleSignal(sig: SignalType) {
    const next = new Set(value.signal_types);
    if (next.has(sig)) next.delete(sig);
    else next.add(sig);
    const arr = Array.from(next) as [SignalType, ...SignalType[]];
    onChange({ ...value, signal_types: arr.length > 0 ? arr : value.signal_types });
  }

  return (
    <div className="space-y-4">
      <BilateralCounterpartiesSkusFields
        skus={value.skus}
        collectAsks
        onChange={({ counterparties, skus, sku_asks }) =>
          onChange({ ...value, counterparties, skus, sku_asks })
        }
      />

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-charcoal">Signals</legend>
        <div className="flex flex-wrap items-center gap-3">
          {SIGNAL_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-1.5 text-sm text-charcoal"
            >
              <input
                type="checkbox"
                aria-label={SIGNAL_TYPE_ABBREVIATIONS[opt.value]}
                checked={value.signal_types.includes(opt.value)}
                onChange={() => toggleSignal(opt.value)}
              />
              <Pill category="signal_type" value={SIGNAL_TYPE_ABBREVIATIONS[opt.value]} />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="block mb-1 font-medium text-charcoal">Depth limit</span>
        <input
          type="number"
          aria-label="Depth limit"
          min={1}
          max={8}
          value={depthDraft}
          onChange={(e) => {
            const raw = e.target.value;
            setDepthDraft(raw);
            const n = Number.parseInt(raw, 10);
            if (Number.isFinite(n) && n >= 1 && n <= 8) {
              onChange({ ...value, depth_limit: n });
            }
          }}
          className="rounded border border-slate-300 px-2 py-1 text-sm w-20"
        />
        <span className="block text-xs text-slate mt-0.5">
          Depth {value.depth_limit} ·{' '}
          {value.depth_limit === 1
            ? 'direct trading partners only'
            : `through ${value.depth_limit - 1} sub-tier${value.depth_limit > 2 ? 's' : ''} (identity redacted)`}
        </span>
      </label>
    </div>
  );
}
