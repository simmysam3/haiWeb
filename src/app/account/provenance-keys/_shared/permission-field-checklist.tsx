'use client';

import type { PermissionField } from '@haiwave/protocol';
import {
  CANONICAL_PERMISSION_FIELDS,
  PERMISSION_FIELD_CATEGORIES,
} from '@haiwave/protocol';

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
