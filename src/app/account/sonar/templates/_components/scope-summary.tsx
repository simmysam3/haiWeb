'use client';

import type { RunTemplateScope } from '@haiwave/protocol';
import { Pill, IdChip } from '@/components';
import { SIGNAL_TYPE_LABELS } from '@/lib/signal-type-labels';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[11px] uppercase tracking-wide text-slate mb-1">
        {label}
      </div>
      <div className="text-sm text-charcoal flex flex-wrap gap-1.5 items-center">
        {children}
      </div>
    </div>
  );
}

const EMPTY = <span className="text-slate">—</span>;

// Counterparties and SKUs are free-form identifiers with no definition, so they
// render via <IdChip> (the established non-Pill identifier primitive) rather
// than <Pill>. Signal types DO have definitions and render via <Pill>. This is
// a deliberate, documented exception to the "all badges via <Pill>" rule.
function Ids({ ids }: { ids: string[] }) {
  if (ids.length === 0) return EMPTY;
  return (
    <>
      {ids.map((id) => (
        <IdChip key={id} id={id} chars={16} />
      ))}
    </>
  );
}

function Signals({ types }: { types: string[] }) {
  if (types.length === 0) return EMPTY;
  return (
    <>
      {types.map((t) => {
        const meta = SIGNAL_TYPE_LABELS[t as keyof typeof SIGNAL_TYPE_LABELS];
        return (
          <Pill key={t} category="signal_type" value={t}>
            {meta?.label ?? t}
          </Pill>
        );
      })}
    </>
  );
}

export function ScopeSummary({ scope }: { scope: RunTemplateScope }) {
  if (scope.kind === 'audit') {
    return (
      <div>
        <Field label="Authorization basis">{scope.authorization_basis}</Field>
        {scope.authorization_basis === 'key_scoped' ? (
          <Field label="Provenance key">
            <IdChip id={scope.provenance_key_id} chars={24} />
          </Field>
        ) : (
          <>
            <Field label="Counterparties">
              <Ids ids={scope.counterparties} />
            </Field>
            <Field label="Signal types">
              <Signals types={scope.signal_types} />
            </Field>
            <Field label="SKUs">
              <Ids ids={scope.skus} />
            </Field>
          </>
        )}
        <Field label="Depth limit">{scope.depth_limit}</Field>
        <Field label="Hop budget">{scope.hop_budget}</Field>
      </div>
    );
  }
  if (scope.kind === 'watcher') {
    return (
      <div>
        <Field label="Counterparties">
          <Ids ids={scope.counterparties} />
        </Field>
        <Field label="Signal types">
          <Signals types={scope.signal_types} />
        </Field>
        <Field label="Depth limit">{scope.depth_limit}</Field>
      </div>
    );
  }
  // v.1.44 refined-PD: new phantom_demand_bom scope (BOM template defaults).
  if (scope.kind === 'phantom_demand_bom') {
    const source = scope.catalog_source ?? { kind: 'own' };
    return (
      <div>
        <Field label="Catalog source">
          {source.kind === 'counterparty' ? (
            <>
              Trading partner
              <IdChip id={source.counterparty_id} chars={24} />
            </>
          ) : (
            'My own catalog'
          )}
        </Field>
        <Field label="SKU">
          <IdChip id={scope.sku} chars={24} />
        </Field>
        <Field label="Default quantity">{scope.default_qty}</Field>
        <Field label="Default target date">
          {scope.default_target_date || EMPTY}
        </Field>
        <Field label="Weeks to hold">{scope.weeks_to_hold}</Field>
        <Field label="Excluded vendors">
          {scope.vendor_exclude.length === 0
            ? EMPTY
            : <>{scope.vendor_exclude.length} vendor{scope.vendor_exclude.length === 1 ? '' : 's'}</>}
        </Field>
      </div>
    );
  }
  // phantom_demand (legacy) — kept for existing templates that still carry this scope shape.
  return (
    <div>
      <Field label="Counterparty">
        <IdChip id={scope.counterparty} chars={24} />
      </Field>
      <Field label="SKUs">
        <Ids ids={scope.skus} />
      </Field>
      <Field label="Hypothetical quantity">{scope.hypothetical_quantity}</Field>
      <Field label="Hypothetical timeline">
        {scope.hypothetical_timeline ?? EMPTY}
      </Field>
    </div>
  );
}
