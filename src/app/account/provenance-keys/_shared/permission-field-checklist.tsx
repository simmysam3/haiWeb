'use client';

import type { PermissionField } from '@haiwave/protocol';

// Turbopack + file: symlink: inline mirror of @haiwave/protocol (sync-comment required).
// Source of truth: packages/protocol/src/provenance/permission-fields.ts (v3.1.0 — Step 1).
const CANONICAL_PERMISSION_FIELDS = [
  'state_province',
  'city',
  'plant_address',
  'plant_identifier',
  'vendor_name',
] as const;

// PERMISSION_FIELD_CATEGORIES removed — redundant at 5 fields.

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
