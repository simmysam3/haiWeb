'use client';

import { useState } from 'react';
import {
  AttributeClassProposalSchema,
  AttributeValueTypeSchema,
  InquiryOperatorSchema,
  InquirySubjectKindSchema,
  InquiryUnitSchema,
  TrustClassSchema,
  type AttributeClassProposal,
  type TrustClass,
} from '@haiwave/protocol';
import { Button } from '@/components';
import { TRUST_CLASS_LABEL } from '@/app/account/sonar/posture/trust-bypass/_components/trust-class-label';

type DisclosureValue = AttributeClassProposal['default_disclosure'][TrustClass];
type GranularityValue = AttributeClassProposal['granularity_ceiling'][TrustClass];

const DISCLOSURE_OPTIONS: { value: DisclosureValue; label: string }[] = [
  { value: 'raw', label: 'Raw value' },
  { value: 'qualified', label: 'Qualified verdict' },
  { value: 'declined', label: 'Declined' },
];
const GRANULARITY_OPTIONS: { value: GranularityValue; label: string }[] = [
  { value: 'aggregate', label: 'Aggregate' },
  { value: 'per_predicate', label: 'Per predicate' },
];

/** A slug -> "Slug" style label, so a tenth AttributeValueType or a twelfth InquiryOperator
 *  renders something readable without this file needing to restate the closed vocabulary. */
function humanize(slug: string): string {
  return slug.replace(/_/g, ' ');
}

/**
 * The submitted value IS the protocol's proposal shape — all fifteen keys, because every one of
 * them is required upstream (the nullable ones are nullable, not optional). Typing the state this
 * way makes a missing key a build error instead of a 400 at runtime (PF P8). Every field below is
 * already schema-valid on its own so that the only two fields the tests fill in — id and display
 * name — are the only thing standing between this default and a passing safeParse.
 */
const EMPTY: AttributeClassProposal = {
  attribute_class_id: '',
  display_name: '',
  subject_types: ['sku'],
  value_type: 'integer',
  unit: null,
  operators_allowed: ['eq'],
  // Written out key by key, so a fifth trust class is a build error, not a missing cell.
  default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'declined', premier_partner: 'declined' },
  granularity_ceiling: { unknown: 'aggregate', behavioral_only: 'aggregate', trading_pair: 'aggregate', premier_partner: 'aggregate' },
  pass_only: false,
  extractor: 'none',
  confidence_floor: null,
  evidence_element_key: null,
  evidence_document_type: null,
  informational_use_only: true,
  attribute_class_evaluation_rule: null,
};
// No cast anywhere in this file: `npm run build` is the only thing in this lane that checks the
// proposal body against the protocol, and a cast is exactly what would blind it (PF P8, PF P12).

function toggle<T>(arr: T[], item: T, checked: boolean): T[] {
  return checked ? [...arr, item] : arr.filter((x) => x !== item);
}

/** '' from a nullable text/number control means "not set" — the schema's `.nullable()` fields
 *  reject an empty string (min(1)) but accept null, so an empty control must map to null, never ''. */
function blankToNull(v: string): string | null {
  return v === '' ? null : v;
}

export function ProposeForm({ onSubmit }: { onSubmit: (value: AttributeClassProposal) => void }) {
  const [value, setValue] = useState<AttributeClassProposal>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    // Mirror the two cross-field refinements client-side so the operator sees them before the 400.
    if ((value.value_type === 'number_with_unit' || value.value_type === 'range') && value.unit === null) {
      setError('A unit is required for number_with_unit and range.');
      return;
    }
    if (value.extractor !== 'none' && value.confidence_floor === null) {
      setError('A confidence floor is required when an extractor is declared.');
      return;
    }
    const parsed = AttributeClassProposalSchema.safeParse(value);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Invalid proposal'); return; }
    setError(null);
    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
      <div>
        <span className="block text-sm font-medium text-charcoal mb-1">Attribute class id</span>
        <input
          aria-label="Attribute class id"
          value={value.attribute_class_id}
          onChange={(e) => setValue((v) => ({ ...v, attribute_class_id: e.target.value }))}
          className="w-full text-sm border border-slate/20 rounded px-2 py-1"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-charcoal mb-1">Display name</span>
        <input
          aria-label="Display name"
          value={value.display_name}
          onChange={(e) => setValue((v) => ({ ...v, display_name: e.target.value }))}
          className="w-full text-sm border border-slate/20 rounded px-2 py-1"
        />
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-charcoal mb-1">Subject types</legend>
        {InquirySubjectKindSchema.options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              aria-label={`Subject type ${opt}`}
              checked={value.subject_types.includes(opt)}
              onChange={(e) => setValue((v) => ({ ...v, subject_types: toggle(v.subject_types, opt, e.target.checked) }))}
            />
            {humanize(opt)}
          </label>
        ))}
      </fieldset>

      <div>
        <span className="block text-sm font-medium text-charcoal mb-1">Value type</span>
        <select
          aria-label="Value type"
          value={value.value_type}
          onChange={(e) => setValue((v) => ({ ...v, value_type: e.target.value as AttributeClassProposal['value_type'] }))}
          className="w-full text-sm border border-slate/20 rounded px-2 py-1"
        >
          {AttributeValueTypeSchema.options.map((opt) => <option key={opt} value={opt}>{humanize(opt)}</option>)}
        </select>
      </div>

      <div>
        <span className="block text-sm font-medium text-charcoal mb-1">Unit</span>
        <select
          aria-label="Unit"
          value={value.unit ?? ''}
          onChange={(e) => setValue((v) => ({ ...v, unit: (blankToNull(e.target.value) as AttributeClassProposal['unit']) }))}
          className="w-full text-sm border border-slate/20 rounded px-2 py-1"
        >
          <option value="">None</option>
          {InquiryUnitSchema.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-charcoal mb-1">Operators allowed</legend>
        {InquiryOperatorSchema.options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              aria-label={`Operator ${opt}`}
              checked={value.operators_allowed.includes(opt)}
              onChange={(e) => setValue((v) => ({ ...v, operators_allowed: toggle(v.operators_allowed, opt, e.target.checked) }))}
            />
            {humanize(opt)}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-charcoal mb-1">Default disclosure</legend>
        {TrustClassSchema.options.map((tc) => (
          <div key={tc} className="flex items-center justify-between gap-2">
            <span className="text-sm text-charcoal">{TRUST_CLASS_LABEL[tc]}</span>
            <select
              aria-label={`Default disclosure for ${TRUST_CLASS_LABEL[tc]}`}
              value={value.default_disclosure[tc]}
              onChange={(e) => {
                const v = e.target.value as DisclosureValue;
                setValue((prev) => ({ ...prev, default_disclosure: { ...prev.default_disclosure, [tc]: v } }));
              }}
              className="text-sm border border-slate/20 rounded px-2 py-1"
            >
              {DISCLOSURE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-charcoal mb-1">Granularity ceiling</legend>
        {TrustClassSchema.options.map((tc) => (
          <div key={tc} className="flex items-center justify-between gap-2">
            <span className="text-sm text-charcoal">{TRUST_CLASS_LABEL[tc]}</span>
            <select
              aria-label={`Granularity ceiling for ${TRUST_CLASS_LABEL[tc]}`}
              value={value.granularity_ceiling[tc]}
              onChange={(e) => {
                const v = e.target.value as GranularityValue;
                setValue((prev) => ({ ...prev, granularity_ceiling: { ...prev.granularity_ceiling, [tc]: v } }));
              }}
              className="text-sm border border-slate/20 rounded px-2 py-1"
            >
              {GRANULARITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input
          type="checkbox"
          aria-label="Pass only"
          checked={value.pass_only}
          onChange={(e) => setValue((v) => ({ ...v, pass_only: e.target.checked }))}
        />
        Pass only
      </label>

      <div>
        <span className="block text-sm font-medium text-charcoal mb-1">Extractor</span>
        <input
          aria-label="Extractor"
          value={value.extractor}
          onChange={(e) => setValue((v) => ({ ...v, extractor: e.target.value }))}
          className="w-full text-sm border border-slate/20 rounded px-2 py-1"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-charcoal mb-1">Confidence floor</span>
        <input
          type="number"
          min={0}
          max={1}
          step="0.01"
          aria-label="Confidence floor"
          value={value.confidence_floor ?? ''}
          onChange={(e) => setValue((v) => ({ ...v, confidence_floor: e.target.value === '' ? null : Number(e.target.value) }))}
          className="w-full text-sm border border-slate/20 rounded px-2 py-1"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-charcoal mb-1">Evidence element key</span>
        <input
          aria-label="Evidence element key"
          value={value.evidence_element_key ?? ''}
          onChange={(e) => setValue((v) => ({ ...v, evidence_element_key: blankToNull(e.target.value) }))}
          className="w-full text-sm border border-slate/20 rounded px-2 py-1"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-charcoal mb-1">Evidence document type</span>
        <input
          aria-label="Evidence document type"
          value={value.evidence_document_type ?? ''}
          onChange={(e) => setValue((v) => ({ ...v, evidence_document_type: blankToNull(e.target.value) }))}
          className="w-full text-sm border border-slate/20 rounded px-2 py-1"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input
          type="checkbox"
          aria-label="Informational use only"
          checked={value.informational_use_only}
          onChange={(e) => setValue((v) => ({ ...v, informational_use_only: e.target.checked }))}
        />
        Informational use only
      </label>

      <div>
        <span className="block text-sm font-medium text-charcoal mb-1">Attribute class evaluation rule</span>
        <textarea
          aria-label="Attribute class evaluation rule"
          value={value.attribute_class_evaluation_rule ?? ''}
          onChange={(e) => setValue((v) => ({ ...v, attribute_class_evaluation_rule: blankToNull(e.target.value) }))}
          className="w-full text-sm border border-slate/20 rounded px-2 py-1"
        />
      </div>

      <Button type="submit">Propose</Button>
      {error && <p className="text-sm text-problem">{error}</p>}
    </form>
  );
}
