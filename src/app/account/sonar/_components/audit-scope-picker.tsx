'use client';

import { useState, useEffect } from 'react';
import type { RunTemplateScope } from '@haiwave/protocol';
import { SYSTEM_AUDIT_HOP_BUDGET } from '../templates/_lib/system-config';
import { BilateralCounterpartiesSkusFields } from './bilateral-counterparties-skus-fields';

type AuditScope = Extract<RunTemplateScope, { kind: 'audit' }>;

interface Props {
  value: AuditScope;
  onChange: (next: AuditScope) => void;
}

export function AuditScopePicker({ value, onChange }: Props) {
  const authBasis = value.authorization_basis;
  const depthLimit = value.depth_limit;
  // hop_budget is system-managed — preserve any existing value on edit but
  // never expose it as a form field. Falls back to the system default for
  // fresh templates.
  const hopBudget =
    'hop_budget' in value ? (value.hop_budget ?? SYSTEM_AUDIT_HOP_BUDGET) : SYSTEM_AUDIT_HOP_BUDGET;

  return (
    <div className="space-y-3">
      <fieldset className="space-y-2" aria-label="Authorization basis">
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="radio"
            name="audit-scope-type"
            checked={authBasis === 'bilateral'}
            onChange={() =>
              onChange({
                kind: 'audit',
                authorization_basis: 'bilateral',
                counterparties: [],
                signal_types: [],
                skus: [],
                depth_limit: depthLimit,
                hop_budget: hopBudget,
              })
            }
          />
          Company scope (vendor IDs)
        </label>
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="radio"
            name="audit-scope-type"
            checked={authBasis === 'key_scoped'}
            onChange={() =>
              onChange({
                kind: 'audit',
                authorization_basis: 'key_scoped',
                provenance_key_id: '',
                depth_limit: depthLimit,
                hop_budget: hopBudget,
              })
            }
          />
          Provenance key
        </label>
      </fieldset>

      {authBasis === 'key_scoped' && (
        <label className="block text-sm text-charcoal">
          <span className="block mb-1 font-medium">Provenance key ID</span>
          <input
            type="text"
            value={'provenance_key_id' in value ? value.provenance_key_id : ''}
            onChange={(e) =>
              onChange({
                kind: 'audit',
                authorization_basis: 'key_scoped',
                provenance_key_id: e.target.value,
                depth_limit: depthLimit,
                hop_budget: hopBudget,
              })
            }
            className="rounded border border-slate-300 px-2 py-1 text-sm w-full"
          />
        </label>
      )}

      <NumberField
        label="Depth limit"
        value={depthLimit}
        min={1}
        max={10}
        onChange={(n) =>
          onChange(
            authBasis === 'key_scoped'
              ? {
                  kind: 'audit',
                  authorization_basis: 'key_scoped',
                  provenance_key_id:
                    'provenance_key_id' in value ? value.provenance_key_id : '',
                  depth_limit: n,
                  hop_budget: hopBudget,
                }
              : {
                  kind: 'audit',
                  authorization_basis: 'bilateral',
                  counterparties: 'counterparties' in value ? value.counterparties : [],
                  signal_types: 'signal_types' in value ? value.signal_types : [],
                  skus: 'skus' in value ? value.skus : [],
                  depth_limit: n,
                  hop_budget: hopBudget,
                },
          )
        }
      />

      {authBasis === 'bilateral' && (
        <BilateralCounterpartiesSkusFields
          counterparties={'counterparties' in value ? value.counterparties : []}
          skus={'skus' in value ? value.skus : []}
          onChange={({ counterparties, skus }) =>
            onChange({
              kind: 'audit',
              authorization_basis: 'bilateral',
              counterparties,
              signal_types: 'signal_types' in value ? value.signal_types : [],
              skus,
              depth_limit: depthLimit,
              hop_budget: hopBudget,
            })
          }
        />
      )}
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
