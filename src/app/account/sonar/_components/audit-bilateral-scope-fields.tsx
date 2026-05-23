'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AuditWizardOptionsResponse } from '@haiwave/protocol';

/**
 * v.1.41 audit-wizard spec restoration (§5.1) — Counterparties + SKUs pickers
 * for the bilateral branch of the New Audit wizard.
 *
 * Data source: GET /api/account/sonar/audit/wizard-options, which returns the
 * auditor's accepted+active audit scopes flattened to (counterparty_id,
 * counterparty_legal_name, product_ids[]). Only state the audit-run service
 * will accept downstream — pending/declined/withdrawn/disabled scopes are
 * filtered out server-side.
 *
 * Behavior:
 *   - Counterparty multi-select. Empty option list = no accepted nominations
 *     exist yet (offers an explanatory CTA to /account/sonar/requests).
 *   - SKU multi-select. Sourced from the union of selected counterparties'
 *     product_ids. Auto-prunes SKUs that no longer belong to any selected
 *     counterparty when the counterparty selection narrows.
 *   - Product names: not surfaced (haiCore doesn't store them; the partner
 *     catalog enrichment used by PhantomDemand's picker isn't worth the
 *     per-counterparty fetch cost here — IDs are the wire identifiers users
 *     already operate on for audit scopes today).
 *
 * Spec §5.5: ≥1 counterparty + ≥1 SKU validation is owned by the wizard, not
 * this component — we surface state, the parent gates submit.
 */

interface Props {
  counterparties: string[];
  skus: string[];
  onChange: (next: { counterparties: string[]; skus: string[] }) => void;
}

type WizardOptions = AuditWizardOptionsResponse;

export function AuditBilateralScopeFields({ counterparties, skus, onChange }: Props) {
  const [options, setOptions] = useState<WizardOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/sonar/audit/wizard-options');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as WizardOptions;
        if (!cancelled) setOptions(body);
      } catch {
        if (!cancelled) setError("Couldn't load accepted audit scopes. Try again in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // SKU candidates = union of product_ids across selected counterparties.
  // Falls back to all options' product_ids when nothing is selected, so users
  // can see the scope of available SKUs before they pick a counterparty.
  const availableSkus = useMemo(() => {
    if (!options) return [] as string[];
    const selected = new Set(counterparties);
    const universe = selected.size > 0
      ? options.counterparties.filter((c) => selected.has(c.counterparty_id))
      : options.counterparties;
    const seen = new Set<string>();
    for (const c of universe) for (const p of c.product_ids) seen.add(p);
    return Array.from(seen).sort();
  }, [options, counterparties]);

  function toggleCounterparty(id: string) {
    const nextCp = counterparties.includes(id)
      ? counterparties.filter((c) => c !== id)
      : [...counterparties, id];
    // Prune any SKUs no longer covered by the remaining counterparty set so we
    // don't carry stale selections into the run.
    let nextSkus = skus;
    if (options) {
      const selected = new Set(nextCp);
      const stillAvailable = new Set<string>();
      for (const c of options.counterparties) {
        if (selected.size > 0 && !selected.has(c.counterparty_id)) continue;
        for (const p of c.product_ids) stillAvailable.add(p);
      }
      nextSkus = skus.filter((s) => stillAvailable.has(s));
    }
    onChange({ counterparties: nextCp, skus: nextSkus });
  }

  function toggleSku(sku: string) {
    const next = skus.includes(sku) ? skus.filter((s) => s !== sku) : [...skus, sku];
    onChange({ counterparties, skus: next });
  }

  if (loading) {
    return <p className="text-sm text-slate italic">Loading accepted audit scopes…</p>;
  }
  if (error) {
    return (
      <div className="rounded border border-problem/30 bg-problem/5 px-3 py-2 text-sm text-problem">
        {error}
      </div>
    );
  }
  if (!options || options.counterparties.length === 0) {
    return (
      <div className="rounded border border-slate/20 bg-slate/5 px-3 py-3 text-sm text-charcoal">
        No counterparties have accepted audit nominations yet. Send a nomination from{' '}
        <a className="text-teal underline" href="/account/sonar/requests/new-nomination">
          Requests → New nomination
        </a>{' '}
        — once a counterparty accepts, they&apos;ll appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-1.5">
        <legend className="block text-sm font-medium text-charcoal">
          Counterparties{' '}
          <span className="text-xs font-normal text-slate">
            ({counterparties.length} of {options.counterparties.length} selected)
          </span>
        </legend>
        <p className="text-xs text-slate">
          Only counterparties whose nominations are in &apos;accepted&apos; state appear here.
        </p>
        <div className="max-h-48 overflow-y-auto rounded border border-slate/20 bg-white px-2 py-1.5">
          {options.counterparties.map((c) => (
            <label
              key={c.counterparty_id}
              className="flex items-center gap-2 text-sm text-charcoal py-0.5"
            >
              <input
                type="checkbox"
                checked={counterparties.includes(c.counterparty_id)}
                onChange={() => toggleCounterparty(c.counterparty_id)}
              />
              <span className="truncate">
                {c.counterparty_legal_name ?? c.counterparty_id}
              </span>
              <span className="ml-auto text-xs text-slate">
                {c.product_ids.length} SKU{c.product_ids.length === 1 ? '' : 's'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="block text-sm font-medium text-charcoal">
          SKUs{' '}
          <span className="text-xs font-normal text-slate">
            ({skus.length} of {availableSkus.length} selected)
          </span>
        </legend>
        <p className="text-xs text-slate">
          {counterparties.length === 0
            ? 'Showing SKUs across all counterparties. Select counterparties above to narrow.'
            : 'SKUs covered by the selected counterparties\' accepted scopes.'}
        </p>
        {availableSkus.length === 0 ? (
          <p className="text-xs italic text-slate">
            No SKUs available — the selected counterparties have no resolvable products under
            their accepted scopes.
          </p>
        ) : (
          <div className="max-h-48 overflow-y-auto rounded border border-slate/20 bg-white px-2 py-1.5">
            {availableSkus.map((sku) => (
              <label
                key={sku}
                className="flex items-center gap-2 text-sm text-charcoal py-0.5 font-mono"
              >
                <input
                  type="checkbox"
                  checked={skus.includes(sku)}
                  onChange={() => toggleSku(sku)}
                />
                <span className="truncate">{sku}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
