'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RunTemplateScope } from '@haiwave/protocol';
import {
  SkuAutocomplete,
  VendorExcludeMultiSelect,
  WeeksToHoldDropdown,
} from '@/components/sonar/phantom-demand';
import { CounterpartyPicker } from './counterparty-picker';
import { CatalogClassBrowser } from './catalog-class-browser';

// v.1.44 refined-PD: operates on the new BOM template scope shape.
// v.1.45: adds the catalog-source radio — the SKU can be picked from the
// initiator's own catalog (BOM-explosion run) or from a trading partner's
// catalog (direct-probe run). catalog_source records which; the SKU
// autocomplete is fed from the corresponding catalog endpoint.
type PdBomScope = Extract<RunTemplateScope, { kind: 'phantom_demand_bom' }>;

interface Props {
  value: PdBomScope;
  onChange: (next: PdBomScope) => void;
}

interface CatalogHit {
  sku: string;
  label: string;
}

interface CatalogProductRow {
  external_product_id: string;
  product_name: string | null;
}

// Both catalog endpoints return the full product list; filter + cap client-side
// to the autocomplete's needs (the input only queries at length >= 2).
function toHits(products: CatalogProductRow[], q: string): CatalogHit[] {
  const needle = q.trim().toLowerCase();
  return products
    .filter(
      (p) =>
        !needle ||
        p.external_product_id.toLowerCase().includes(needle) ||
        (p.product_name ?? '').toLowerCase().includes(needle),
    )
    .slice(0, 20)
    .map((p) => ({
      sku: p.external_product_id,
      label: p.product_name ?? p.external_product_id,
    }));
}

export function PhantomDemandScopeFields({ value, onChange }: Props) {
  // The qty field keeps its own string draft so the user can fully clear and
  // retype it. Only propagate valid positive integers to the parent scope.
  const [qtyDraft, setQtyDraft] = useState(String(value.default_qty));
  useEffect(() => {
    setQtyDraft(String(value.default_qty));
  }, [value.default_qty]);

  const source = value.catalog_source ?? { kind: 'own' };
  const counterpartyId =
    source.kind === 'counterparty' ? source.counterparty_id : '';

  // Own catalog: the initiator's own origin-manifest catalog.
  const ownFetcher = useCallback(async (q: string): Promise<CatalogHit[]> => {
    const res = await fetch('/api/account/sonar/manifest-catalog');
    if (!res.ok) return [];
    const body = (await res.json()) as { products?: CatalogProductRow[] };
    return toHits(body.products ?? [], q);
  }, []);

  // Trading-partner catalog: the selected counterparty's published catalog.
  const partnerFetcher = useCallback(
    async (q: string): Promise<CatalogHit[]> => {
      if (!counterpartyId) return [];
      const res = await fetch(
        `/api/account/partners/${encodeURIComponent(counterpartyId)}/catalog/products?page=1&size=500`,
      );
      if (!res.ok) return [];
      const body = (await res.json()) as { products?: CatalogProductRow[] };
      return toHits(body.products ?? [], q);
    },
    [counterpartyId],
  );

  const skuFetcher = source.kind === 'counterparty' ? partnerFetcher : ownFetcher;

  // v1.55 — absent on pre-v1.55 templates → 'full' (no fan-out).
  const runMode = value.run_mode ?? 'full';

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="block mb-1 text-sm font-medium text-charcoal">
          Catalog source
        </legend>
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="radio"
            name="pd-catalog-source"
            checked={source.kind === 'own'}
            // Switching source clears the SKU — it belongs to one catalog.
            onChange={() =>
              onChange({ ...value, catalog_source: { kind: 'own' }, sku: '' })
            }
          />
          My own catalog
        </label>
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="radio"
            name="pd-catalog-source"
            checked={source.kind === 'counterparty'}
            onChange={() =>
              onChange({
                ...value,
                catalog_source: { kind: 'counterparty', counterparty_id: '' },
                sku: '',
              })
            }
          />
          A trading partner&apos;s catalog
        </label>
      </fieldset>

      {source.kind === 'counterparty' && (
        <div className="block text-sm text-charcoal">
          <span className="block mb-1 font-medium">Trading partner</span>
          <CounterpartyPicker
            value={counterpartyId}
            onChange={(id) =>
              onChange({
                ...value,
                catalog_source: { kind: 'counterparty', counterparty_id: id },
                sku: '',
              })
            }
          />
        </div>
      )}

      {/* v1.55 — run type. Only the own-catalog (buyer-side BOM) path fans out
          to interchangeable vendors, so the readiness option is gated to
          catalog_source=own; the counterparty direct-probe path is always a
          full run and the run-service ignores run_mode there. */}
      {source.kind === 'own' && (
        <fieldset className="space-y-2">
          <legend className="block mb-1 text-sm font-medium text-charcoal">
            Run type
          </legend>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="radio"
              name="pd-run-mode"
              checked={runMode !== 'alternates'}
              onChange={() => onChange({ ...value, run_mode: 'full' })}
            />
            Full BOM
          </label>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="radio"
              name="pd-run-mode"
              checked={runMode === 'alternates'}
              onChange={() => onChange({ ...value, run_mode: 'alternates' })}
            />
            Readiness (interchangeable vendors)
          </label>
          <p className="text-xs italic text-slate">
            Readiness walks the BOM structure and fans out to each component&apos;s
            interchangeable vendors to gauge sourcing readiness, instead of a full
            quantity-driven BOM explosion.
          </p>
        </fieldset>
      )}

      <div className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">SKU</span>
        <SkuAutocomplete
          value={value.sku}
          onChange={(sku) => onChange({ ...value, sku })}
          fetcher={skuFetcher}
          placeholder={
            source.kind === 'counterparty' && !counterpartyId
              ? 'Select a trading partner first…'
              : 'Search by product name or SKU…'
          }
        />
        {source.kind === 'counterparty' && !counterpartyId ? (
          <p className="mt-2 text-xs italic text-slate">
            Select a trading partner to browse their catalog.
          </p>
        ) : (
          <div className="mt-2">
            <span className="block mb-1 text-xs uppercase tracking-wide text-slate">
              Or browse by product class
            </span>
            <CatalogClassBrowser
              catalog={
                source.kind === 'counterparty'
                  ? { kind: 'counterparty', counterpartyId }
                  : { kind: 'own' }
              }
              selectedSku={value.sku}
              onSelect={(sku) => onChange({ ...value, sku })}
            />
          </div>
        )}
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
