'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GroupedAccordion,
  AccordionGroupRow,
  AccordionLeafRow,
  AccordionLoading,
  AccordionError,
  AccordionEmpty,
} from '@/components/grouped-accordion';
import { IdChip } from '@/components';

// v.1.45 — class-grouped product browser for the PD SKU picker. Lets the user
// explore their own catalog (or a trading partner's) by product class and pick
// a SKU, complementing the type-ahead search. Built on the shared
// grouped-accordion primitive so it matches the provenance / audit browsers.
export type CatalogRef =
  | { kind: 'own' }
  | { kind: 'counterparty'; counterpartyId: string };

interface ClassGroup {
  // The param used to fetch this class's products — class_slug for the own
  // (provenance) catalog, class_id for a partner catalog.
  productKey: string;
  name: string;
  count: number;
}

interface ProductRow {
  sku: string;
  label: string;
}

interface ProductState {
  loading: boolean;
  loaded: boolean;
  rows: ProductRow[];
  /** haiCore's count for the whole class; more than `rows` when the page is short. */
  total: number;
  /** Pages fetched so far (the class browser pages a large class; R-5b). */
  page: number;
  loadingMore?: boolean;
  error?: string;
}

interface Props {
  catalog: CatalogRef;
  selectedSku: string;
  onSelect: (sku: string) => void;
}

function catalogId(c: CatalogRef): string {
  return c.kind === 'own' ? 'own' : `cp:${c.counterpartyId}`;
}

async function fetchClasses(catalog: CatalogRef): Promise<ClassGroup[]> {
  if (catalog.kind === 'own') {
    const res = await fetch('/api/account/provenance/grouped');
    if (!res.ok) throw new Error(`Couldn't load product classes (${res.status}).`);
    const body = (await res.json()) as {
      classes?: { class_slug: string; class_name: string; sku_count: number }[];
    };
    return (body.classes ?? []).map((c) => ({
      productKey: c.class_slug,
      name: c.class_name,
      count: c.sku_count,
    }));
  }
  const res = await fetch(
    `/api/account/partners/${encodeURIComponent(catalog.counterpartyId)}/catalog/classes`,
  );
  if (!res.ok) throw new Error(`Couldn't load product classes (${res.status}).`);
  const body = (await res.json()) as {
    classes?: { class_id: string; class_name: string; product_count: number }[];
  };
  return (body.classes ?? []).map((c) => ({
    productKey: c.class_id,
    name: c.class_name,
    count: c.product_count,
  }));
}

/** One page of a class's products plus haiCore's count for the whole class. */
interface ProductPage {
  rows: ProductRow[];
  total: number;
}

const PRODUCT_PAGE_SIZE = 500;

async function fetchProducts(
  catalog: CatalogRef,
  productKey: string,
  page = 1,
): Promise<ProductPage> {
  if (catalog.kind === 'own') {
    const res = await fetch(
      `/api/account/provenance/grouped/${encodeURIComponent(productKey)}?page=${page}&page_size=${PRODUCT_PAGE_SIZE}`,
    );
    if (!res.ok) throw new Error(`Couldn't load products (${res.status}).`);
    const body = (await res.json()) as {
      skus?: { external_product_id: string; product_name: string }[];
      total?: number;
    };
    const rows = (body.skus ?? []).map((s) => ({
      sku: s.external_product_id,
      label: s.product_name,
    }));
    return { rows, total: body.total ?? rows.length };
  }
  const res = await fetch(
    `/api/account/partners/${encodeURIComponent(catalog.counterpartyId)}/catalog/products?class_id=${encodeURIComponent(productKey)}&page=${page}&size=${PRODUCT_PAGE_SIZE}`,
  );
  if (!res.ok) throw new Error(`Couldn't load products (${res.status}).`);
  const body = (await res.json()) as {
    products?: { external_product_id: string; product_name: string | null }[];
    total?: number;
  };
  const rows = (body.products ?? []).map((p) => ({
    sku: p.external_product_id,
    label: p.product_name ?? p.external_product_id,
  }));
  return { rows, total: body.total ?? rows.length };
}

export function CatalogClassBrowser({ catalog, selectedSku, onSelect }: Props) {
  const cid = catalogId(catalog);
  // catalog is rebuilt by the parent each render; read it through a ref so the
  // fetch effects can depend on the stable `cid` instead of the object.
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Record<string, ProductState>>({});
  // Keys whose product fetch has already been kicked off (guards StrictMode
  // double-invocation + re-render re-entry from firing duplicate requests).
  const requested = useRef<Set<string>>(new Set());

  // (Re)load the class list whenever the catalog changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExpanded(new Set());
    setProducts({});
    requested.current = new Set();
    fetchClasses(catalogRef.current)
      .then((rows) => {
        if (!cancelled) setClasses(rows);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load catalog.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cid]);

  // Lazy-load the products for any class that has been expanded.
  useEffect(() => {
    let cancelled = false;
    expanded.forEach((key) => {
      if (requested.current.has(key)) return;
      requested.current.add(key);
      setProducts((prev) => ({
        ...prev,
        [key]: { loading: true, loaded: false, rows: [], total: 0, page: 0 },
      }));
      fetchProducts(catalogRef.current, key)
        .then(({ rows, total }) => {
          if (!cancelled)
            setProducts((prev) => ({
              ...prev,
              [key]: { loading: false, loaded: true, rows, total, page: 1 },
            }));
        })
        .catch((e) => {
          if (!cancelled)
            setProducts((prev) => ({
              ...prev,
              [key]: {
                loading: false,
                loaded: true,
                rows: [],
                total: 0,
                page: 0,
                error: e instanceof Error ? e.message : 'Failed to load products.',
              },
            }));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [expanded, cid]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Next page of a large class, appended; a refusal is said in place.
  function loadMore(key: string) {
    const current = products[key];
    if (!current || current.loadingMore) return;
    const next = current.page + 1;
    setProducts((prev) => ({ ...prev, [key]: { ...prev[key], loadingMore: true } }));
    fetchProducts(catalogRef.current, key, next)
      .then(({ rows, total }) =>
        setProducts((prev) => ({
          ...prev,
          [key]: { ...prev[key], rows: [...prev[key].rows, ...rows], total, page: next, loadingMore: false },
        })),
      )
      .catch((e) =>
        setProducts((prev) => ({
          ...prev,
          [key]: { ...prev[key], loadingMore: false, error: e instanceof Error ? e.message : 'Failed to load products.' },
        })),
      );
  }

  if (loading) return <AccordionLoading>Loading product classes…</AccordionLoading>;
  if (error)
    return (
      <div className="rounded border border-slate/20 bg-white">
        <AccordionError>{error}</AccordionError>
      </div>
    );
  if (classes.length === 0)
    return (
      <div className="rounded border border-slate/20 bg-white">
        <AccordionEmpty>No product classes found in this catalog.</AccordionEmpty>
      </div>
    );

  return (
    <GroupedAccordion initialExpanded="none">
      {classes.map((cls) => {
        const isOpen = expanded.has(cls.productKey);
        const pstate = products[cls.productKey];
        return (
          <AccordionGroupRow
            key={cls.productKey}
            groupKey={cls.productKey}
            label={cls.name}
            count={cls.count}
            expanded={isOpen}
            onToggle={() => toggle(cls.productKey)}
          >
            {pstate?.loading && <AccordionLoading />}
            {pstate?.error && <AccordionError>{pstate.error}</AccordionError>}
            {pstate?.loaded && !pstate.error && pstate.rows.length === 0 && (
              <AccordionEmpty>No products in this class.</AccordionEmpty>
            )}
            {pstate?.loaded && !pstate.error && pstate.total > pstate.rows.length && (
              <p className="flex items-center justify-between gap-3 px-3 py-2 text-xs italic text-slate" role="note">
                <span>
                  Showing the first {pstate.rows.length.toLocaleString()} of{' '}
                  {pstate.total.toLocaleString()} products in this class.
                </span>
                <button
                  type="button"
                  className="not-italic rounded border border-slate/30 px-2 py-1 text-xs text-charcoal hover:bg-slate/10 disabled:opacity-50"
                  disabled={pstate.loadingMore}
                  onClick={() => loadMore(cls.productKey)}
                >
                  {pstate.loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </p>
            )}
            {pstate?.loaded &&
              pstate.rows.map((row) => (
                <AccordionLeafRow
                  key={row.sku}
                  label={row.label}
                  onClick={() => onSelect(row.sku)}
                  metaSlot={
                    <>
                      <IdChip id={row.sku} chars={16} />
                      {row.sku === selectedSku && (
                        <span
                          className="text-teal text-lg font-bold"
                          aria-label="Selected"
                        >
                          ✓
                        </span>
                      )}
                    </>
                  }
                />
              ))}
          </AccordionGroupRow>
        );
      })}
    </GroupedAccordion>
  );
}
