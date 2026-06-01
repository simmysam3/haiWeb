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

async function fetchProducts(
  catalog: CatalogRef,
  productKey: string,
): Promise<ProductRow[]> {
  if (catalog.kind === 'own') {
    const res = await fetch(
      `/api/account/provenance/grouped/${encodeURIComponent(productKey)}?page=1&page_size=500`,
    );
    if (!res.ok) throw new Error(`Couldn't load products (${res.status}).`);
    const body = (await res.json()) as {
      skus?: { external_product_id: string; product_name: string }[];
    };
    return (body.skus ?? []).map((s) => ({
      sku: s.external_product_id,
      label: s.product_name,
    }));
  }
  const res = await fetch(
    `/api/account/partners/${encodeURIComponent(catalog.counterpartyId)}/catalog/products?class_id=${encodeURIComponent(productKey)}&page=1&size=500`,
  );
  if (!res.ok) throw new Error(`Couldn't load products (${res.status}).`);
  const body = (await res.json()) as {
    products?: { external_product_id: string; product_name: string | null }[];
  };
  return (body.products ?? []).map((p) => ({
    sku: p.external_product_id,
    label: p.product_name ?? p.external_product_id,
  }));
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
        [key]: { loading: true, loaded: false, rows: [] },
      }));
      fetchProducts(catalogRef.current, key)
        .then((rows) => {
          if (!cancelled)
            setProducts((prev) => ({
              ...prev,
              [key]: { loading: false, loaded: true, rows },
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
