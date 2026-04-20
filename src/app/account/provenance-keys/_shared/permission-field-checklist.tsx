'use client';

import type { PermissionField } from '@haiwave/protocol';

/**
 * Inlined from @haiwave/protocol to avoid Turbopack Windows symlink resolution
 * failure when importing CJS runtime values from a file: package. Remove this
 * inline once the symlink limitation is resolved and restore the protocol import.
 */
const CANONICAL_PERMISSION_FIELDS = [
  // Location
  'facility_country',
  'facility_region',
  'facility_id',
  'facility_name',
  'facility_type',
  // Process
  'entry_type',
  // Compliance
  'verification_method',
  'verification_date',
  'domestic_context',
  // Chain depth
  'subcomponent_origins',
  // Traceability
  'batch_number',
  'manufacturing_date',
  // Metadata
  'provenance_depth',
] as const satisfies readonly PermissionField[];

const PERMISSION_FIELD_CATEGORIES: Record<PermissionField, string> = {
  facility_country: 'location',
  facility_region: 'location',
  facility_id: 'location',
  facility_name: 'location',
  facility_type: 'location',
  entry_type: 'process',
  verification_method: 'compliance',
  verification_date: 'compliance',
  domestic_context: 'compliance',
  subcomponent_origins: 'chain_depth',
  batch_number: 'traceability',
  manufacturing_date: 'traceability',
  provenance_depth: 'metadata',
};

export interface PermissionFieldChecklistProps {
  value: readonly PermissionField[];
  onChange: (next: PermissionField[]) => void;
  readOnly?: readonly PermissionField[];
  disabledReasons?: Partial<Record<PermissionField, string>>;
}

export function PermissionFieldChecklist({
  value,
  onChange,
  readOnly = [],
  disabledReasons,
}: PermissionFieldChecklistProps) {
  const selected = new Set(value);
  const readOnlySet = new Set(readOnly);

  return (
    <ul className="space-y-1">
      {CANONICAL_PERMISSION_FIELDS.map((field) => (
        <li key={field} className="flex items-center gap-2">
          <input
            id={`field-${field}`}
            type="checkbox"
            className="rounded border-slate/40 text-teal focus:ring-teal/30"
            checked={selected.has(field)}
            disabled={readOnlySet.has(field)}
            onChange={(e) => {
              const next = new Set(selected);
              if (e.target.checked) next.add(field);
              else next.delete(field);
              onChange([...next]);
            }}
          />
          <label htmlFor={`field-${field}`} className="text-sm text-charcoal">
            <span className="font-mono">{field}</span>
            <span className="ml-2 text-xs text-slate">
              ({PERMISSION_FIELD_CATEGORIES[field]})
            </span>
            {disabledReasons?.[field] && (
              <span className="ml-2 text-xs text-slate italic">
                — {disabledReasons[field]}
              </span>
            )}
          </label>
        </li>
      ))}
    </ul>
  );
}
