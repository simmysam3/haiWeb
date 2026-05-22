'use client';

import { useState, useEffect } from 'react';
import type { RunTemplateScope, SignalType } from '@haiwave/protocol';
import { SIGNAL_TYPE_LABELS } from '@/lib/signal-type-labels';
import { PhantomDemandScopeFields } from './phantom-demand-scope-fields';

// v1.40: the audit modality was dropped from the template wizard (this
// component's only caller). Audit scope is configured via the dedicated
// AuditScopePicker on /account/sonar/audit/new, not here.
type ObservationClass = 'watcher' | 'phantom_demand';

interface ScopePickerProps {
  observationClass: ObservationClass;
  value: RunTemplateScope;
  onChange: (next: RunTemplateScope) => void;
}

const WATCHER_SIGNALS: { value: SignalType; label: string; tooltip: string }[] = (
  Object.entries(SIGNAL_TYPE_LABELS) as [SignalType, { label: string; tooltip: string }][]
).map(([value, meta]) => ({ value, label: meta.label, tooltip: meta.tooltip }));

export function ScopePicker({ observationClass, value, onChange }: ScopePickerProps) {
  if (observationClass === 'watcher') {
    // Narrow to watcher scope
    const watcherValue = value.kind === 'watcher' ? value : null;
    const selectedSignals = new Set<SignalType>(watcherValue?.signal_types ?? []);
    const depthLimit = watcherValue?.depth_limit ?? 1;

    function toggleSignal(sig: SignalType) {
      const next = new Set(selectedSignals);
      if (next.has(sig)) next.delete(sig);
      else next.add(sig);
      onChange({
        kind: 'watcher',
        authorization_basis: 'bilateral',
        counterparties: watcherValue?.counterparties ?? [],
        signal_types: Array.from(next) as [SignalType, ...SignalType[]],
        depth_limit: depthLimit,
      });
    }

    return (
      <div className="space-y-3">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-charcoal">Signal types</legend>
          {WATCHER_SIGNALS.map((s) => (
            <label
              key={s.value}
              className="flex items-center gap-2 text-sm text-charcoal"
              title={s.tooltip}
            >
              <input
                type="checkbox"
                checked={selectedSignals.has(s.value)}
                onChange={() => toggleSignal(s.value)}
              />
              {s.label}
            </label>
          ))}
        </fieldset>
        <NumberField
          label="Depth limit"
          value={depthLimit}
          min={1}
          max={8}
          onChange={(n) =>
            onChange({
              kind: 'watcher',
              authorization_basis: 'bilateral',
              counterparties: watcherValue?.counterparties ?? [],
              signal_types: watcherValue?.signal_types ?? ['lead_time_distribution'],
              depth_limit: n,
            })
          }
        />
        <p className="text-xs text-slate">
          Counterparty filter is omitted (defaults to all tier-1 partners).
        </p>
      </div>
    );
  }

  // phantom_demand branch — delegated to a dedicated component (v1.31).
  const pdValue: Extract<RunTemplateScope, { kind: 'phantom_demand' }> =
    value.kind === 'phantom_demand'
      ? value
      : {
          kind: 'phantom_demand',
          authorization_basis: 'bilateral',
          counterparty: '',
          skus: [],
          hypothetical_quantity: 1,
          hypothetical_timeline: null,
        };
  return <PhantomDemandScopeFields value={pdValue} onChange={onChange} />;
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [display, setDisplay] = useState(String(value));

  useEffect(() => {
    setDisplay(String(value));
  }, [value]);

  return (
    <label className="block text-sm text-charcoal">
      <span className="block mb-1 font-medium">{label}</span>
      <input
        type="number"
        aria-label={label}
        value={display}
        min={min}
        max={max}
        onChange={(e) => {
          setDisplay(e.target.value);
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="rounded border border-slate-300 px-2 py-1 text-sm w-24"
      />
    </label>
  );
}
