'use client';

import { useState, useEffect } from 'react';
import type { RunTemplateScope, SignalType } from '@haiwave/protocol';

interface ScopePickerProps {
  observationClass: 'audit' | 'type2';
  value: RunTemplateScope;
  onChange: (next: RunTemplateScope) => void;
}

const TYPE2_SIGNALS: { value: SignalType; label: string }[] = [
  { value: 'lead_time_distribution', label: 'Lead time distribution' },
  { value: 'capacity_utilization_band', label: 'Capacity utilization band' },
  { value: 'delivery_event', label: 'Latest delivery event' },
];

export function ScopePicker({ observationClass, value, onChange }: ScopePickerProps) {
  if (observationClass === 'audit') {
    if (value.scope_type === 'company') {
      return (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-charcoal">Audit scope</legend>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="radio"
                name="audit-scope-type"
                checked
                readOnly
              />
              Company scope (vendor IDs)
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="radio"
                name="audit-scope-type"
                onChange={() =>
                  onChange({
                    scope_type: 'key',
                    provenance_key_id: '',
                    depth_limit: value.depth_limit,
                    hop_budget: value.hop_budget,
                  })
                }
              />
              Provenance key
            </label>
          </fieldset>
          <NumberField
            label="Depth limit"
            value={value.depth_limit ?? 1}
            min={1}
            max={5}
            onChange={(n) => onChange({ ...value, depth_limit: n })}
          />
          <NumberField
            label="Hop budget"
            value={value.hop_budget ?? 5}
            min={1}
            max={50}
            onChange={(n) => onChange({ ...value, hop_budget: n })}
          />
          <p className="text-xs text-slate">
            Vendor IDs come from active audit scopes; selection UI is configured
            from /account/sonar/audit/nominations and is not editable here.
          </p>
        </div>
      );
    }
    if (value.scope_type === 'key') {
      return (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-charcoal">Audit scope</legend>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="radio"
                name="audit-scope-type"
                onChange={() =>
                  onChange({
                    scope_type: 'company',
                    scope_ids: [],
                    depth_limit: value.depth_limit,
                    hop_budget: value.hop_budget,
                  })
                }
              />
              Company scope (vendor IDs)
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="radio"
                name="audit-scope-type"
                checked
                readOnly
              />
              Provenance key
            </label>
          </fieldset>
          <label className="block text-sm text-charcoal">
            <span className="block mb-1 font-medium">Provenance key ID</span>
            <input
              type="text"
              value={value.provenance_key_id}
              onChange={(e) =>
                onChange({ ...value, provenance_key_id: e.target.value })
              }
              className="rounded border border-slate-300 px-2 py-1 text-sm w-full"
            />
          </label>
          <NumberField
            label="Depth limit"
            value={value.depth_limit ?? 1}
            min={1}
            max={5}
            onChange={(n) => onChange({ ...value, depth_limit: n })}
          />
          <NumberField
            label="Hop budget"
            value={value.hop_budget ?? 5}
            min={1}
            max={50}
            onChange={(n) => onChange({ ...value, hop_budget: n })}
          />
        </div>
      );
    }
  }

  // type2 scope — use 'in' check to read signal_types without requiring scope_type discriminant
  const type2Value = 'signal_types' in value ? value : null;
  const selectedSignals = new Set<SignalType>(type2Value?.signal_types ?? []);
  function toggleSignal(sig: SignalType) {
    const next = new Set(selectedSignals);
    if (next.has(sig)) next.delete(sig);
    else next.add(sig);
    onChange({
      ...value,
      signal_types: Array.from(next),
    } as RunTemplateScope);
  }
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-charcoal">Signal types</legend>
        {TYPE2_SIGNALS.map((s) => (
          <label key={s.value} className="flex items-center gap-2 text-sm text-charcoal">
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
        value={type2Value?.depth_limit ?? 1}
        min={1}
        max={8}
        onChange={(n) => onChange({ ...value, depth_limit: n } as RunTemplateScope)}
      />
      <p className="text-xs text-slate">
        Counterparty filter is omitted (defaults to all tier-1 partners).
      </p>
    </div>
  );
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
