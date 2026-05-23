'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuditWizardOptionsResponse } from '@haiwave/protocol';
import type { CatalogClass, CatalogProduct } from '@/lib/haiwave-api';

/**
 * v.1.41 audit-wizard spec restoration (§5.1) — Counterparties + Classes +
 * SKUs picker for the bilateral branch of the New Audit wizard.
 *
 * Hierarchy:
 *   Counterparty ▶  (checkbox = select all of this counterparty's accepted SKUs)
 *     Class      ▶  (checkbox = select all class members for this counterparty)
 *       SKU      ⬜  (individual product checkbox)
 *
 * Data sources (no local shadow of remote catalog):
 *   - /api/account/sonar/audit/wizard-options
 *       → authoritative set of (counterparty, accepted product_ids)
 *   - /api/account/partners/:id/catalog/{classes,products}
 *       → product NAMES + class display labels, pulled from each
 *         participant's catalog interface (per data-residency rule:
 *         vendor + product class + sku→class mapping is the only thing
 *         held locally; names/SKUs are pulled from the agent on demand)
 *
 * Selection is materialised as a flat scope.skus[] (with scope.counterparties
 * derived from which counterparties have at least one selected SKU). The
 * server's resolveTemplateScopeIds maps that flat list back to whichever
 * accepted audit_scopes cover them — a class-scope acceptance gets hit for
 * whole-class selections, product-scope acceptances for individual SKUs.
 * No new protocol shape needed.
 *
 * Catalog enrichment is lazy per counterparty — fetched the first time the
 * counterparty is expanded so we don't fan out to every partner on mount.
 */

interface Props {
  counterparties: string[];
  skus: string[];
  onChange: (next: { counterparties: string[]; skus: string[] }) => void;
}

type WizardOptions = AuditWizardOptionsResponse;
type CounterpartyOption = WizardOptions['counterparties'][number];

interface CatalogState {
  loading: boolean;
  loaded: boolean;
  error?: string;
  // class_slug → display name. Includes a synthetic 'unclassified' entry for
  // products with null primary_class_slug so they still render.
  classNames: Map<string, string>;
  // class_slug → product[]. Pre-filtered to the auditor's accepted SKU set.
  byClass: Map<string, CatalogProduct[]>;
  // SKU ids the catalog couldn't enrich with a name (catalog endpoint missed
  // them but they're in the accepted product set). Surfaced under a separate
  // 'no catalog match' group so they're still selectable.
  orphanIds: string[];
}

const UNCLASSIFIED_SLUG = '__unclassified__';

export function AuditBilateralScopeFields({ counterparties: _ignored, skus, onChange }: Props) {
  const [options, setOptions] = useState<WizardOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [expandedCounterparties, setExpandedCounterparties] = useState<Set<string>>(new Set());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [catalogs, setCatalogs] = useState<Map<string, CatalogState>>(new Map());

  // Fetch the authoritative accepted-scopes universe once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/sonar/audit/wizard-options');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as WizardOptions;
        if (!cancelled) setOptions(body);
      } catch {
        if (!cancelled) setOptionsError("Couldn't load accepted audit scopes. Try again in a moment.");
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Selected SKUs as a Set for O(1) checks; derived counterparties below.
  const selectedSkus = useMemo(() => new Set(skus), [skus]);

  const loadCatalog = useCallback(
    async (cp: CounterpartyOption) => {
      if (catalogs.get(cp.counterparty_id)?.loaded || catalogs.get(cp.counterparty_id)?.loading) {
        return;
      }
      setCatalogs((prev) => {
        const next = new Map(prev);
        next.set(cp.counterparty_id, {
          loading: true,
          loaded: false,
          classNames: new Map(),
          byClass: new Map(),
          orphanIds: [],
        });
        return next;
      });
      try {
        const [classesRes, productsRes] = await Promise.all([
          fetch(`/api/account/partners/${encodeURIComponent(cp.counterparty_id)}/catalog/classes`),
          fetch(
            `/api/account/partners/${encodeURIComponent(cp.counterparty_id)}/catalog/products?page=1&size=500`,
          ),
        ]);
        if (!classesRes.ok) throw new Error(`classes ${classesRes.status}`);
        if (!productsRes.ok) throw new Error(`products ${productsRes.status}`);
        const classesBody = (await classesRes.json()) as { classes: CatalogClass[] };
        const productsBody = (await productsRes.json()) as {
          products: CatalogProduct[];
          total: number;
        };

        const accepted = new Set(cp.product_ids);
        const classNames = new Map<string, string>();
        for (const c of classesBody.classes ?? []) {
          classNames.set(c.class_slug, c.class_name);
        }
        classNames.set(UNCLASSIFIED_SLUG, 'Unclassified');

        const byClass = new Map<string, CatalogProduct[]>();
        const seen = new Set<string>();
        for (const p of productsBody.products ?? []) {
          if (!accepted.has(p.external_product_id)) continue;
          seen.add(p.external_product_id);
          const slug = p.primary_class_slug ?? UNCLASSIFIED_SLUG;
          let bucket = byClass.get(slug);
          if (!bucket) {
            bucket = [];
            byClass.set(slug, bucket);
          }
          bucket.push(p);
        }
        // Sort products within each class by name (id fallback) for stable
        // display.
        for (const bucket of byClass.values()) {
          bucket.sort((a, b) => {
            const an = a.product_name ?? a.external_product_id;
            const bn = b.product_name ?? b.external_product_id;
            return an.localeCompare(bn, undefined, { sensitivity: 'base' });
          });
        }
        // Accepted SKUs the catalog endpoint didn't return — keep selectable
        // so the picker doesn't silently drop them.
        const orphanIds = cp.product_ids.filter((id) => !seen.has(id)).sort();

        setCatalogs((prev) => {
          const next = new Map(prev);
          next.set(cp.counterparty_id, {
            loading: false,
            loaded: true,
            classNames,
            byClass,
            orphanIds,
          });
          return next;
        });
      } catch {
        setCatalogs((prev) => {
          const next = new Map(prev);
          next.set(cp.counterparty_id, {
            loading: false,
            loaded: false,
            error: "Couldn't load catalog for this counterparty.",
            classNames: new Map(),
            byClass: new Map(),
            orphanIds: [],
          });
          return next;
        });
      }
    },
    [catalogs],
  );

  function toggleCounterpartyExpanded(cp: CounterpartyOption) {
    setExpandedCounterparties((prev) => {
      const next = new Set(prev);
      if (next.has(cp.counterparty_id)) {
        next.delete(cp.counterparty_id);
      } else {
        next.add(cp.counterparty_id);
        // Lazy-load catalog the first time this counterparty is opened.
        void loadCatalog(cp);
      }
      return next;
    });
  }

  function toggleClassExpanded(key: string) {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applySelection(nextSelected: Set<string>) {
    if (!options) return;
    // Derive counterparties from which counterparty owns any selected SKU.
    const cpSet = new Set<string>();
    for (const cp of options.counterparties) {
      if (cp.product_ids.some((p) => nextSelected.has(p))) {
        cpSet.add(cp.counterparty_id);
      }
    }
    onChange({ counterparties: Array.from(cpSet), skus: Array.from(nextSelected) });
  }

  function toggleSku(skuId: string) {
    const next = new Set(selectedSkus);
    if (next.has(skuId)) next.delete(skuId);
    else next.add(skuId);
    applySelection(next);
  }

  function setSkusForGroup(ids: string[], select: boolean) {
    const next = new Set(selectedSkus);
    if (select) for (const id of ids) next.add(id);
    else for (const id of ids) next.delete(id);
    applySelection(next);
  }

  // ── Counterparty-level selection summary ─────────────────────────────
  function counterpartySelectionState(cp: CounterpartyOption): 'none' | 'partial' | 'all' {
    if (cp.product_ids.length === 0) return 'none';
    let hits = 0;
    for (const id of cp.product_ids) if (selectedSkus.has(id)) hits += 1;
    if (hits === 0) return 'none';
    if (hits === cp.product_ids.length) return 'all';
    return 'partial';
  }

  function classSelectionState(productIds: string[]): 'none' | 'partial' | 'all' {
    if (productIds.length === 0) return 'none';
    let hits = 0;
    for (const id of productIds) if (selectedSkus.has(id)) hits += 1;
    if (hits === 0) return 'none';
    if (hits === productIds.length) return 'all';
    return 'partial';
  }

  if (optionsLoading) {
    return <p className="text-sm text-slate italic">Loading accepted audit scopes…</p>;
  }
  if (optionsError) {
    return (
      <div className="rounded border border-problem/30 bg-problem/5 px-3 py-2 text-sm text-problem">
        {optionsError}
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

  const totalSelected = selectedSkus.size;
  const totalAvailable = options.counterparties.reduce((n, c) => n + c.product_ids.length, 0);

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate">
        {totalSelected} of {totalAvailable} SKU{totalAvailable === 1 ? '' : 's'} selected
        across {options.counterparties.length} counterpart
        {options.counterparties.length === 1 ? 'y' : 'ies'} with accepted scopes.
      </p>

      <div className="space-y-1 rounded border border-slate/20 bg-white">
        {options.counterparties.map((cp) => {
          const cpExpanded = expandedCounterparties.has(cp.counterparty_id);
          const cpState = counterpartySelectionState(cp);
          const catalog = catalogs.get(cp.counterparty_id);
          return (
            <div
              key={cp.counterparty_id}
              className="border-b border-slate/10 last:border-b-0"
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  type="button"
                  aria-label={cpExpanded ? 'Collapse counterparty' : 'Expand counterparty'}
                  onClick={() => toggleCounterpartyExpanded(cp)}
                  className="w-4 text-xs text-slate hover:text-charcoal"
                >
                  {cpExpanded ? '▼' : '▶'}
                </button>
                <input
                  type="checkbox"
                  aria-label={`Select all from ${cp.counterparty_legal_name ?? cp.counterparty_id}`}
                  checked={cpState === 'all'}
                  ref={(el) => {
                    if (el) el.indeterminate = cpState === 'partial';
                  }}
                  onChange={() => setSkusForGroup(cp.product_ids, cpState !== 'all')}
                />
                <span className="text-sm text-charcoal truncate">
                  {cp.counterparty_legal_name ?? cp.counterparty_id}
                </span>
                <span className="ml-auto text-xs text-slate whitespace-nowrap">
                  {cpState === 'none'
                    ? `${cp.product_ids.length} SKU${cp.product_ids.length === 1 ? '' : 's'}`
                    : `${cp.product_ids.filter((id) => selectedSkus.has(id)).length} / ${cp.product_ids.length} selected`}
                </span>
              </div>

              {cpExpanded && (
                <div className="pl-7 pb-1.5">
                  {!catalog || catalog.loading ? (
                    <p className="text-xs italic text-slate py-1">Loading catalog…</p>
                  ) : catalog.error ? (
                    <p className="text-xs text-problem py-1">{catalog.error}</p>
                  ) : (
                    <>
                      {Array.from(catalog.byClass.entries()).map(([slug, products]) => {
                        const classKey = `${cp.counterparty_id}|${slug}`;
                        const classExpanded = expandedClasses.has(classKey);
                        const classState = classSelectionState(
                          products.map((p) => p.external_product_id),
                        );
                        const className = catalog.classNames.get(slug) ?? slug;
                        return (
                          <div key={classKey} className="text-sm">
                            <div className="flex items-center gap-2 py-0.5">
                              <button
                                type="button"
                                aria-label={
                                  classExpanded ? 'Collapse class' : 'Expand class'
                                }
                                onClick={() => toggleClassExpanded(classKey)}
                                className="w-4 text-xs text-slate hover:text-charcoal"
                              >
                                {classExpanded ? '▼' : '▶'}
                              </button>
                              <input
                                type="checkbox"
                                aria-label={`Select all in ${className}`}
                                checked={classState === 'all'}
                                ref={(el) => {
                                  if (el) el.indeterminate = classState === 'partial';
                                }}
                                onChange={() =>
                                  setSkusForGroup(
                                    products.map((p) => p.external_product_id),
                                    classState !== 'all',
                                  )
                                }
                              />
                              <span className="text-charcoal truncate">{className}</span>
                              <span className="ml-auto text-xs text-slate whitespace-nowrap">
                                {classState === 'none'
                                  ? `${products.length} SKU${products.length === 1 ? '' : 's'}`
                                  : `${products.filter((p) => selectedSkus.has(p.external_product_id)).length} / ${products.length} selected`}
                              </span>
                            </div>
                            {classExpanded && (
                              <div className="pl-7 py-0.5">
                                {products.map((p) => (
                                  <label
                                    key={p.external_product_id}
                                    className="flex items-center gap-2 py-0.5"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedSkus.has(p.external_product_id)}
                                      onChange={() => toggleSku(p.external_product_id)}
                                    />
                                    <span className="truncate text-charcoal">
                                      {p.product_name ?? '(unnamed product)'}
                                    </span>
                                    <span className="ml-auto text-xs font-mono text-slate truncate">
                                      {p.external_product_id}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {catalog.orphanIds.length > 0 && (
                        <details className="text-xs text-slate py-1">
                          <summary>
                            {catalog.orphanIds.length} accepted SKU
                            {catalog.orphanIds.length === 1 ? '' : 's'} not in this
                            counterparty&apos;s public catalog
                          </summary>
                          <div className="pl-4 mt-1 space-y-0.5">
                            {catalog.orphanIds.map((id) => (
                              <label key={id} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedSkus.has(id)}
                                  onChange={() => toggleSku(id)}
                                />
                                <span className="font-mono text-slate truncate">{id}</span>
                              </label>
                            ))}
                          </div>
                        </details>
                      )}
                      {catalog.byClass.size === 0 && catalog.orphanIds.length === 0 && (
                        <p className="text-xs italic text-slate py-1">
                          No matching products in catalog.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
