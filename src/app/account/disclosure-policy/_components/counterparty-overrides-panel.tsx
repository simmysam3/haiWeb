'use client';

import type { AttributeClassSummary, Disclosure, DisclosurePolicyOverrideRow } from '@/lib/safe-room-types';

/** The override body — keyed (counterparty × attribute class). No trust class: the wire has none. */
export interface OverrideWrite {
  attribute_class_id: string;
  disclosure: Disclosure;
  disclose_shortfall_quantity: boolean | null;
}

interface Props {
  classes: AttributeClassSummary[];
  overrides: DisclosurePolicyOverrideRow[];
  onSaveOverride: (row: OverrideWrite) => void;
}

export function CounterpartyOverridesPanel({ classes, overrides, onSaveOverride }: Props) {
  return (
    <table className="w-full text-sm border border-slate/15 rounded-md overflow-hidden">
      <thead><tr className="bg-light-gray text-charcoal text-xs font-semibold"><th className="p-2 text-left">Attribute class</th><th className="p-2 text-left">Source</th><th className="p-2 text-left">Disclosure</th><th className="p-2 text-left">Shortfall quantity</th></tr></thead>
      <tbody>
        {classes.map((c) => {
          const current = overrides.find((o) => o.attribute_class_id === c.attribute_class_id) ?? null;
          return (
            <tr key={c.attribute_class_id} className="border-t border-slate/10">
              <td className="p-2 text-charcoal">{c.display_name}</td>
              <td className="p-2 text-slate">{current ? 'Override' : 'Inherited'}</td>
              <td className="p-2">
                <select
                  aria-label={`${c.attribute_class_id} override disclosure`}
                  value={current?.disclosure ?? ''}
                  onChange={(e) => onSaveOverride({ attribute_class_id: c.attribute_class_id, disclosure: e.target.value as Disclosure, disclose_shortfall_quantity: current?.disclose_shortfall_quantity ?? null })}
                  className="w-full text-sm border border-slate/20 rounded px-2 py-1"
                >
                  <option value="" disabled>— inherited —</option>
                  {(['raw', 'qualified', 'declined'] as const).map((dv) => <option key={dv} value={dv}>{dv}</option>)}
                </select>
              </td>
              <td className="p-2">
                {/*
                  C1 fix (review-L7-1): an override never infers its disclosure. This panel has
                  no trust class for the counterparty, so no correct disclosure is derivable
                  client-side for a row that still inherits the matrix. The control stays
                  disabled — and its handler stays guarded, belt-and-suspenders — until the
                  operator has explicitly chosen a disclosure for this row via the other select,
                  at which point `current` is non-null and the row's own chosen disclosure (never
                  a default) is what gets forwarded.
                */}
                <select
                  aria-label={`${c.attribute_class_id} override shortfall quantity`}
                  aria-describedby={current === null ? `${c.attribute_class_id}-shortfall-hint` : undefined}
                  disabled={current === null}
                  value={current === null || current.disclose_shortfall_quantity === null ? 'inherit' : String(current.disclose_shortfall_quantity)}
                  onChange={(e) => {
                    if (current === null) return;
                    onSaveOverride({
                      attribute_class_id: c.attribute_class_id,
                      disclosure: current.disclosure,
                      disclose_shortfall_quantity: e.target.value === 'inherit' ? null : e.target.value === 'true',
                    });
                  }}
                  className="w-full text-sm border border-slate/20 rounded px-2 py-1"
                >
                  <option value="inherit">Inherit</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                {current === null && (
                  <p id={`${c.attribute_class_id}-shortfall-hint`} className="mt-1 text-[11px] text-slate">
                    Choose a disclosure to override this counterparty
                  </p>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
