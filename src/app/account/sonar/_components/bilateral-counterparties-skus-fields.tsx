'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuditWizardOptionsResponse, SkuAsk } from '@haiwave/protocol';
import type { CatalogClass, CatalogProduct } from '@/lib/haiwave-api';
import {
  GroupedAccordion,
  AccordionGroupRow,
  AccordionLeafRow,
  AccordionLoading,
  AccordionError,
} from '@/components/grouped-accordion';
import { TristateCheckbox } from '@/components/tristate-checkbox';

/**
 * Bilateral scope picker — counterparties + skus drill-down. Modality-neutral:
 * audit and watcher consume the same shape (counterparties: uuid[], skus:
 * external_product_id strings). Renamed from <AuditBilateralScopeFields> in
 * v.1.43 Plan 2 when the watcher scope picker came online.
 *
 * Original framing (v.1.41 audit-wizard spec restoration §5.1) — Counterparties
 * + Classes + SKUs picker for the bilateral branch of the New Audit wizard.
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
  skus: string[];
  // Saved asks to hydrate the per-SKU drafts from (edit flow). Without this,
  // editing a saved readiness watcher would start from blank drafts and the
  // next selection change would re-emit sku_asks WITHOUT the saved entries —
  // silently wiping them on save.
  skuAsks?: SkuAsk[];
  onChange: (next: { counterparties: string[]; skus: string[]; sku_asks: SkuAsk[] }) => void;
  // Readiness watchers collect a per-SKU forward-demand ask (quantity + target
  // date) inline at each selected SKU. Off by default so the shared audit
  // picker keeps its plain SKU-selection surface — audit ignores sku_asks.
  collectAsks?: boolean;
}

// Per-SKU ask draft held in local state. Both fields are NaN until the user
// types a value; an ask is emitted as a sku_asks entry only once BOTH a
// positive quantity AND a positive target window (calendar days) are present.
// target_days is a rolling offset from each run's date, not a fixed date.
interface AskDraft {
  ask_quantity: number;
  target_days: number;
}

// "If run today" preview of the rolling target window — today + N calendar days,
// shown next to the days input. Presentational only; the stored ask keeps the
// offset (target_days) so each run resolves against its own date.
function previewTargetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

export function BilateralCounterpartiesSkusFields({ skus, skuAsks, onChange, collectAsks = false }: Props) {
  const [options, setOptions] = useState<WizardOptions | null>(null);
  // sku → forward-demand ask draft. Kept even for currently-deselected SKUs so
  // re-selecting restores a typed value; only selected SKUs are emitted.
  // Seeded from the saved asks (edit flow) so existing entries render in the
  // inputs and survive unrelated selection changes.
  const [asks, setAsks] = useState<Map<string, AskDraft>>(() => {
    const seeded = new Map<string, AskDraft>();
    for (const ask of skuAsks ?? []) {
      seeded.set(ask.sku, { ask_quantity: ask.ask_quantity, target_days: ask.target_days });
    }
    return seeded;
  });
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
        if (!cancelled) setOptionsError("Couldn't load accepted counterparties. Try again in a moment.");
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

  function emitWith(nextSelected: Set<string>, nextAsks: Map<string, AskDraft>) {
    if (!options) return;
    // Derive counterparties from which counterparty owns any selected SKU.
    const cpSet = new Set<string>();
    for (const cp of options.counterparties) {
      if (cp.product_ids.some((p) => nextSelected.has(p))) {
        cpSet.add(cp.counterparty_id);
      }
    }
    // Emit an ask only for selected SKUs that carry BOTH a positive quantity
    // and a positive target window (calendar days). A quantity-only draft is
    // held locally, not emitted — an incomplete ask would fail the run.
    const skuAsks: SkuAsk[] = [];
    for (const sku of nextSelected) {
      const draft = nextAsks.get(sku);
      if (
        draft &&
        Number.isFinite(draft.ask_quantity) &&
        draft.ask_quantity > 0 &&
        Number.isFinite(draft.target_days) &&
        draft.target_days > 0
      ) {
        skuAsks.push({
          sku,
          ask_quantity: draft.ask_quantity,
          target_days: draft.target_days,
        });
      }
    }
    onChange({
      counterparties: Array.from(cpSet),
      skus: Array.from(nextSelected),
      sku_asks: skuAsks,
    });
  }

  function applySelection(nextSelected: Set<string>) {
    emitWith(nextSelected, asks);
  }

  function updateAsk(sku: string, patch: Partial<AskDraft>) {
    const current = asks.get(sku) ?? { ask_quantity: Number.NaN, target_days: Number.NaN };
    const next = new Map(asks);
    next.set(sku, { ...current, ...patch });
    setAsks(next);
    emitWith(selectedSkus, next);
  }

  // Inline forward-demand ask inputs — rendered only for readiness watchers
  // (collectAsks) at a currently-selected SKU. Null everywhere else so the
  // shared audit picker is unchanged. Rendered on the leaf row's detail line
  // (AccordionLeafRow detailSlot), which has room for visible labels and the
  // full predicted-date preview.
  function askInputs(sku: string) {
    if (!collectAsks || !selectedSkus.has(sku)) return null;
    const draft = asks.get(sku);
    const qtyValue = draft && Number.isFinite(draft.ask_quantity) ? String(draft.ask_quantity) : '';
    const daysValue = draft && Number.isFinite(draft.target_days) ? String(draft.target_days) : '';
    // "if run today" preview so the rolling window reads as a concrete date
    // without pinning the stored value to one — the ask stays run_date + N days.
    const preview = draft && Number.isFinite(draft.target_days) && draft.target_days > 0
      ? previewTargetDate(draft.target_days)
      : null;
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate">
        <label className="flex items-center gap-1.5">
          <span>Quantity</span>
          <input
            type="number"
            min={1}
            aria-label={`Ask quantity for ${sku}`}
            value={qtyValue}
            onChange={(e) => updateAsk(sku, { ask_quantity: Number.parseInt(e.target.value, 10) })}
            className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span>Target window</span>
          <input
            type="number"
            min={1}
            required
            aria-label={`Target window in calendar days for ${sku}`}
            value={daysValue}
            onChange={(e) => updateAsk(sku, { target_days: Number.parseInt(e.target.value, 10) })}
            className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
          />
          <span>calendar days</span>
        </label>
        {preview && (
          <span className="whitespace-nowrap" aria-hidden>
            → ~{preview} if run today
          </span>
        )}
      </span>
    );
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

  // ── Selection summary — shared by the counterparty and class rows ────
  function selectionState(ids: string[]): 'none' | 'partial' | 'all' {
    if (ids.length === 0) return 'none';
    let hits = 0;
    for (const id of ids) if (selectedSkus.has(id)) hits += 1;
    if (hits === 0) return 'none';
    if (hits === ids.length) return 'all';
    return 'partial';
  }

  function countFor(
    ids: string[],
    state: 'none' | 'partial' | 'all',
  ): string | { filtered: number; total: number } {
    if (state === 'none') return `${ids.length} SKU${ids.length === 1 ? '' : 's'}`;
    return { filtered: ids.filter((id) => selectedSkus.has(id)).length, total: ids.length };
  }

  if (optionsLoading) {
    return <p className="text-sm text-slate italic">Loading accepted counterparties…</p>;
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
        No counterparties have accepted a nomination yet. Send a nomination from{' '}
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

      <GroupedAccordion>
        {options.counterparties.map((cp) => {
          const cpExpanded = expandedCounterparties.has(cp.counterparty_id);
          const cpState = selectionState(cp.product_ids);
          const catalog = catalogs.get(cp.counterparty_id);
          const cpCount = countFor(cp.product_ids, cpState);
          return (
            <AccordionGroupRow
              key={cp.counterparty_id}
              groupKey={cp.counterparty_id}
              label={cp.counterparty_legal_name ?? cp.counterparty_id}
              count={cpCount}
              controlSlot={
                <TristateCheckbox
                  state={cpState}
                  onChange={(next) => setSkusForGroup(cp.product_ids, next === 'all')}
                  ariaLabel={`Select all from ${cp.counterparty_legal_name ?? cp.counterparty_id}`}
                />
              }
              expanded={cpExpanded}
              onToggle={() => toggleCounterpartyExpanded(cp)}
            >
              {!catalog || catalog.loading ? (
                <AccordionLoading>Loading catalog…</AccordionLoading>
              ) : catalog.error ? (
                <AccordionError>{catalog.error}</AccordionError>
              ) : (
                <>
                  <GroupedAccordion>
                    {Array.from(catalog.byClass.entries()).map(([slug, products]) => {
                      const classKey = `${cp.counterparty_id}|${slug}`;
                      const classExpanded = expandedClasses.has(classKey);
                      const classProductIds = products.map((p) => p.external_product_id);
                      const classState = selectionState(classProductIds);
                      const className = catalog.classNames.get(slug) ?? slug;
                      const classCount = countFor(classProductIds, classState);
                      return (
                        <AccordionGroupRow
                          key={classKey}
                          groupKey={classKey}
                          label={className}
                          count={classCount}
                          controlSlot={
                            <TristateCheckbox
                              state={classState}
                              onChange={(next) =>
                                setSkusForGroup(
                                  products.map((p) => p.external_product_id),
                                  next === 'all',
                                )
                              }
                              ariaLabel={`Select all in ${className}`}
                            />
                          }
                          expanded={classExpanded}
                          onToggle={() => toggleClassExpanded(classKey)}
                        >
                          {products.map((p) => (
                            <AccordionLeafRow
                              key={p.external_product_id}
                              controlSlot={
                                <input
                                  type="checkbox"
                                  checked={selectedSkus.has(p.external_product_id)}
                                  onChange={() => toggleSku(p.external_product_id)}
                                />
                              }
                              label={p.product_name ?? '(unnamed product)'}
                              metaSlot={
                                <span className="text-xs font-mono text-slate truncate">
                                  {p.external_product_id}
                                </span>
                              }
                              detailSlot={askInputs(p.external_product_id)}
                            />
                          ))}
                        </AccordionGroupRow>
                      );
                    })}
                  </GroupedAccordion>

                  {catalog.orphanIds.length > 0 && (
                    <details className="text-xs text-slate py-1">
                      <summary>
                        {catalog.orphanIds.length} accepted SKU
                        {catalog.orphanIds.length === 1 ? '' : 's'} not in this
                        counterparty&apos;s public catalog
                      </summary>
                      <div className="pl-4 mt-1 space-y-0.5">
                        {catalog.orphanIds.map((id) => {
                          const ask = askInputs(id);
                          return (
                            <div key={id}>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedSkus.has(id)}
                                  onChange={() => toggleSku(id)}
                                />
                                <span className="font-mono text-slate truncate">{id}</span>
                              </label>
                              {ask && <div className="pl-6 pt-0.5">{ask}</div>}
                            </div>
                          );
                        })}
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
            </AccordionGroupRow>
          );
        })}
      </GroupedAccordion>
    </div>
  );
}
