'use client';

import type { RunTemplateScope } from '@haiwave/protocol';
import { PhantomDemandScopeFields } from './phantom-demand-scope-fields';

// v1.40: the audit modality was dropped from the template wizard (this
// component's only caller). Audit scope is configured via the dedicated
// AuditScopePicker on /account/sonar/audit/new.
// v.1.45: the watcher modality was likewise dropped — watchers are created via
// the dedicated /watchers/new wizard. This wizard is phantom-demand-only, so
// ScopePicker normalizes to the phantom_demand_bom shape and delegates to
// PhantomDemandScopeFields.
interface ScopePickerProps {
  value: RunTemplateScope;
  onChange: (next: RunTemplateScope) => void;
}

export function ScopePicker({ value, onChange }: ScopePickerProps) {
  // v.1.44 refined-PD: delegate to PhantomDemandScopeFields, which operates on
  // the phantom_demand_bom template scope shape. A non-PD value (e.g. a legacy
  // template loaded into this wizard) falls back to an empty BOM scope.
  const pdValue: Extract<RunTemplateScope, { kind: 'phantom_demand_bom' }> =
    value.kind === 'phantom_demand_bom'
      ? value
      : {
          kind: 'phantom_demand_bom',
          sku: '',
          default_qty: 1,
          default_target_date: '',
          vendor_exclude: [],
          weeks_to_hold: 1,
          catalog_source: { kind: 'own' },
        };
  return <PhantomDemandScopeFields value={pdValue} onChange={onChange} />;
}
