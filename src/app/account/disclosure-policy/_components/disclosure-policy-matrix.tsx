'use client';

import type { TrustClass } from '@haiwave/protocol';
import { TRUST_CLASS_LABEL } from '@/app/account/sonar/posture/trust-bypass/_components/trust-class-label';
import type { AttributeClassSummary, Disclosure, DisclosurePolicyRow } from '@/lib/safe-room-types';

const TRUST_CLASSES = ['unknown', 'behavioral_only', 'trading_pair', 'premier_partner'] as const;
const DISCLOSURE_LABEL: Record<Disclosure, string> = { raw: 'Raw value', qualified: 'Qualified verdict', declined: 'Declined' };

/** The whole cell — what the full-replace PUT requires (PF P5). */
export interface PolicyCell {
  attribute_class_id: string;
  trust_class: TrustClass;
  disclosure: Disclosure;
  disclose_shortfall_quantity: boolean;
}

interface Props {
  classes: AttributeClassSummary[];
  rows: DisclosurePolicyRow[];
  onSave: (cell: PolicyCell) => void;
}

function resolveCell(c: AttributeClassSummary, rows: DisclosurePolicyRow[], tc: TrustClass): PolicyCell {
  const row = rows.find((r) => r.attribute_class_id === c.attribute_class_id && r.trust_class === tc);
  return row
    ? { attribute_class_id: c.attribute_class_id, trust_class: tc, disclosure: row.disclosure, disclose_shortfall_quantity: row.disclose_shortfall_quantity }
    : { attribute_class_id: c.attribute_class_id, trust_class: tc, disclosure: c.default_disclosure[tc], disclose_shortfall_quantity: false };
}

export function DisclosurePolicyMatrix({ classes, rows, onSave }: Props) {
  return (
    <div role="grid" className="grid grid-cols-5 gap-px bg-slate/15 border border-slate/15 rounded-md overflow-hidden">
      <div className="bg-light-gray p-3 text-xs font-semibold text-charcoal">Attribute class / Trust class</div>
      {TRUST_CLASSES.map((tc) => <div key={tc} className="bg-light-gray p-3 text-xs font-semibold text-charcoal">{TRUST_CLASS_LABEL[tc]}</div>)}
      {classes.map((c) => (
        <MatrixRow key={c.attribute_class_id} attributeClass={c} rows={rows} onSave={onSave} />
      ))}
    </div>
  );
}

function MatrixRow({ attributeClass, rows, onSave }: { attributeClass: AttributeClassSummary; rows: DisclosurePolicyRow[]; onSave: Props['onSave'] }) {
  return (
    <>
      <div className="bg-white p-3 text-sm font-medium text-charcoal">{attributeClass.display_name}</div>
      {TRUST_CLASSES.map((tc) => {
        const cell = resolveCell(attributeClass, rows, tc);
        return (
          <div key={tc} className="bg-white p-3 space-y-2">
            <select
              aria-label={`${attributeClass.attribute_class_id} disclosure for ${tc}`}
              value={cell.disclosure}
              onChange={(e) => onSave({ ...cell, disclosure: e.target.value as Disclosure })}
              className="w-full text-sm border border-slate/20 rounded px-2 py-1"
            >
              {(['raw', 'qualified', 'declined'] as const).map((dv) => <option key={dv} value={dv}>{DISCLOSURE_LABEL[dv]}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-slate">
              <input
                type="checkbox"
                aria-label={`${attributeClass.attribute_class_id} disclose shortfall quantity for ${tc}`}
                checked={cell.disclose_shortfall_quantity}
                onChange={(e) => onSave({ ...cell, disclose_shortfall_quantity: e.target.checked })}
              />
              Disclose shortfall
            </label>
          </div>
        );
      })}
    </>
  );
}
