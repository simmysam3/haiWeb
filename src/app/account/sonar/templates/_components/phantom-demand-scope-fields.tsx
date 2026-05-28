'use client';

import { useEffect, useState } from 'react';
import type { RunTemplateScope } from '@haiwave/protocol';
import {
  SkuAutocomplete,
  VendorExcludeMultiSelect,
  WeeksToHoldDropdown,
} from '@/components/sonar/phantom-demand';

// v.1.44 refined-PD: operates on the new BOM template scope shape.
// The legacy PhantomDemandScope (kind:'phantom_demand') is no longer emitted
// by this component; it is preserved in the protocol union for existing templates.
type PdBomScope = Extract<RunTemplateScope, { kind: 'phantom_demand_bom' }>;

interface Props {
  value: PdBomScope;
  onChange: (next: PdBomScope) => void;
}

// Stub fetcher — catalog wiring (calling the BFF SKU search endpoint) is a
// post-v1 enhancement. The autocomplete will show no suggestions until that is
// wired up; users can still type a SKU directly.
async function stubSkuFetcher(_q: string): Promise<{ sku: string; label: string }[]> {
  return [];
}

export function PhantomDemandScopeFields({ value, onChange }: Props) {
  // The qty field keeps its own string draft so the user can fully clear and
  // retype it. Only propagate valid positive integers to the parent scope.
  const [qtyDraft, setQtyDraft] = useState(String(value.default_qty));
  useEffect(() => {
    setQtyDraft(String(value.default_qty));
  }, [value.default_qty]);

  return (
    <div className="space-y-4">
      <div className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">SKU</span>
        {/* Catalog wiring (fetching SKU suggestions from the BFF) is a
            post-v1 enhancement. The stub fetcher returns [] — users type directly. */}
        <SkuAutocomplete
          value={value.sku}
          onChange={(sku) => onChange({ ...value, sku })}
          fetcher={stubSkuFetcher}
          placeholder="Type a SKU..."
        />
      </div>

      <label className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Default Quantity</span>
        <input
          type="number"
          aria-label="Default Quantity"
          min={1}
          value={qtyDraft}
          onChange={(e) => {
            const raw = e.target.value;
            setQtyDraft(raw);
            const n = Number.parseInt(raw, 10);
            if (Number.isInteger(n) && n > 0) {
              onChange({ ...value, default_qty: n });
            }
          }}
          onBlur={() => {
            const n = Number.parseInt(qtyDraft, 10);
            if (!Number.isInteger(n) || n <= 0) {
              setQtyDraft(String(value.default_qty));
            }
          }}
          className="rounded border border-slate-300 px-2 py-1 text-sm w-32"
        />
      </label>

      <label className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Default Target Date</span>
        <input
          type="date"
          aria-label="Default Target Date"
          value={value.default_target_date}
          onChange={(e) =>
            onChange({ ...value, default_target_date: e.target.value })
          }
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <span className="block text-xs text-slate mt-1">
          ISO date (YYYY-MM-DD) used as the default when triggering a run.
        </span>
      </label>

      <div className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium" id="weeks-to-hold-label">
          Save Phantom Demand request for (weeks):
        </span>
        <WeeksToHoldDropdown
          ariaLabelledBy="weeks-to-hold-label"
          value={value.weeks_to_hold}
          onChange={(weeks_to_hold) => onChange({ ...value, weeks_to_hold })}
        />
      </div>

      <div className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Exclude Vendors</span>
        {/* Vendor options are not yet wired to the BFF counterparty list.
            Population of this picker is a post-v1 enhancement. */}
        <VendorExcludeMultiSelect
          options={[]}
          value={value.vendor_exclude}
          onChange={(vendor_exclude) => onChange({ ...value, vendor_exclude })}
        />
      </div>
    </div>
  );
}
