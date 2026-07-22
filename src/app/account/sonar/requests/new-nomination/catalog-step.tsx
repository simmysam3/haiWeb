'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuditScopeCoverage } from '@haiwave/protocol';
import type { CatalogClass, CatalogProduct } from '@/lib/haiwave-api';
import type { FormSelections, PartnerSummary } from './types';
import { DetailChevron } from '@/components/sonar/observations';

interface ProductsState {
  loading: boolean;
  loaded: boolean;
  products: CatalogProduct[];
  error?: string;
}

interface Props {
  vendor: PartnerSummary;
  selections: FormSelections;
  onChange: (
    next: FormSelections,
    labels?: { classLabels?: Record<string, string>; productLabels?: Record<string, string> },
  ) => void;
  onAdvance: () => void;
  onBack: () => void;
}

export function CatalogStep({ vendor, selections, onChange, onAdvance, onBack }: Props) {
  const [classes, setClasses] = useState<CatalogClass[]>([]);
  const [coverage, setCoverage] = useState<AuditScopeCoverage | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [products, setProducts] = useState<Record<string, ProductsState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [classesRes, covRes] = await Promise.all([
          fetch(`/api/account/partners/${encodeURIComponent(vendor.id)}/catalog/classes`),
          fetch(`/api/account/audit-coverage?vendor_id=${encodeURIComponent(vendor.id)}`),
        ]);
        if (!classesRes.ok) throw new Error(`classes ${classesRes.status}`);
        if (!covRes.ok) throw new Error(`coverage ${covRes.status}`);
        const classesBody = (await classesRes.json()) as { classes: CatalogClass[] };
        const cov = (await covRes.json()) as AuditScopeCoverage;
        if (cancelled) return;
        setClasses(classesBody.classes ?? []);
        setCoverage(cov);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load catalog');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendor.id]);

  const loadProductsForClass = useCallback(
    async (classId: string) => {
      setProducts((prev) => ({
        ...prev,
        [classId]: { loading: true, loaded: prev[classId]?.loaded ?? false, products: prev[classId]?.products ?? [] },
      }));
      try {
        const res = await fetch(
          `/api/account/partners/${encodeURIComponent(vendor.id)}/catalog/products?class_id=${encodeURIComponent(classId)}&page=1&size=500`,
        );
        if (!res.ok) throw new Error(`products ${res.status}`);
        const body = (await res.json()) as { products: CatalogProduct[]; total: number };
        setProducts((prev) => ({
          ...prev,
          [classId]: { loading: false, loaded: true, products: body.products ?? [] },
        }));
      } catch (e) {
        setProducts((prev) => ({
          ...prev,
          [classId]: {
            loading: false,
            loaded: false,
            products: [],
            error: e instanceof Error ? e.message : 'Failed to load products',
          },
        }));
      }
    },
    [vendor.id],
  );

  const onToggleExpand = useCallback(
    async (classId: string) => {
      const willExpand = !expanded[classId];
      setExpanded((prev) => ({ ...prev, [classId]: willExpand }));
      if (willExpand && !products[classId]?.loaded && !products[classId]?.loading) {
        await loadProductsForClass(classId);
      }
    },
    [expanded, products, loadProductsForClass],
  );

  const toggleClass = useCallback(
    (klass: CatalogClass) => {
      const nextClasses = new Set(selections.classes);
      if (nextClasses.has(klass.class_id)) nextClasses.delete(klass.class_id);
      else nextClasses.add(klass.class_id);
      onChange(
        { classes: nextClasses, products: selections.products },
        { classLabels: { [klass.class_id]: klass.class_name } },
      );
    },
    [selections, onChange],
  );

  const toggleProduct = useCallback(
    (product: CatalogProduct) => {
      const nextProducts = new Set(selections.products);
      if (nextProducts.has(product.external_product_id)) nextProducts.delete(product.external_product_id);
      else nextProducts.add(product.external_product_id);
      onChange(
        { classes: selections.classes, products: nextProducts },
        {
          productLabels: {
            [product.external_product_id]: product.product_name ?? product.external_product_id,
          },
        },
      );
    },
    [selections, onChange],
  );

  const canContinue = selections.classes.size + selections.products.size > 0;

  const summary = useMemo(() => {
    const classCount = selections.classes.size;
    const productCount = selections.products.size;
    if (classCount === 0 && productCount === 0) return 'Pick at least one class or SKU.';
    const parts: string[] = [];
    if (classCount > 0) parts.push(`${classCount} class${classCount === 1 ? '' : 'es'}`);
    if (productCount > 0) parts.push(`${productCount} SKU${productCount === 1 ? '' : 's'}`);
    return `Selected: ${parts.join(' + ')}.`;
  }, [selections]);

  if (loading) return <p className="text-sm text-slate italic">Loading catalog…</p>;
  if (error) {
    return (
      <div className="rounded border border-problem/30 bg-problem/5 px-3 py-2 text-sm text-problem">
        Could not load {vendor.legal_name}&apos;s catalog: {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate uppercase tracking-wider">{summary}</p>

      {coverage?.company && (
        <p className="rounded border border-slate/20 bg-light-gray px-3 py-2 text-xs text-slate">
          {vendor.legal_name} is already covered by a company-wide scope. Anything you add here is redundant.
        </p>
      )}

      <div className="rounded border border-slate/20 bg-white divide-y divide-slate/10">
        {classes.map((klass) => {
          const isAlreadyCovered = !!coverage?.classes[klass.class_id];
          const isSelected = selections.classes.has(klass.class_id);
          const isExpanded = !!expanded[klass.class_id];
          const productsState = products[klass.class_id];
          return (
            <div key={klass.class_id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <input
                  id={`class-${klass.class_id}`}
                  type="checkbox"
                  aria-label={klass.class_name}
                  checked={isAlreadyCovered || isSelected}
                  disabled={isAlreadyCovered}
                  onChange={() => toggleClass(klass)}
                  className="h-4 w-4 accent-teal"
                />
                <label htmlFor={`class-${klass.class_id}`} className="flex-1 cursor-pointer">
                  <p className="text-sm font-medium text-charcoal">{klass.class_name}</p>
                  <p className="text-xs text-slate">
                    {klass.product_count} product{klass.product_count === 1 ? '' : 's'}
                    {isAlreadyCovered && ' — already nominated'}
                  </p>
                </label>
                <button
                  type="button"
                  onClick={() => onToggleExpand(klass.class_id)}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Hide' : 'Show'} products in ${klass.class_name}`}
                  className="group shrink-0 p-1 -m-1 text-slate hover:text-navy"
                >
                  <DetailChevron expanded={isExpanded} />
                </button>
              </div>

              {isExpanded && (
                <div className="bg-light-gray px-4 py-3 border-t border-slate/10">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate mb-2">Products</p>
                  {productsState?.loading && <p className="text-xs text-slate italic">Loading products…</p>}
                  {productsState?.error && <p className="text-xs text-problem">{productsState.error}</p>}
                  {productsState?.loaded && productsState.products.length === 0 && (
                    <p className="text-xs text-slate italic">No products in this class.</p>
                  )}
                  {productsState?.loaded && productsState.products.length > 0 && (
                    <ul className="space-y-1">
                      {productsState.products.map((product) => {
                        const productAlreadyCovered =
                          !!coverage?.products[product.external_product_id] ||
                          !!coverage?.company;
                        const inheritedFromSelectedClass = isSelected;
                        const productSelected = selections.products.has(product.external_product_id);
                        const disabled =
                          productAlreadyCovered || inheritedFromSelectedClass;
                        const checked = disabled ? true : productSelected;
                        return (
                          <li
                            key={product.external_product_id}
                            className={`flex items-center gap-3 pl-6 py-1.5 ${
                              disabled ? 'opacity-60' : ''
                            }`}
                          >
                            <input
                              id={`product-${product.external_product_id}`}
                              type="checkbox"
                              aria-label={product.product_name ?? product.external_product_id}
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleProduct(product)}
                              className="h-4 w-4 accent-teal"
                            />
                            <label
                              htmlFor={`product-${product.external_product_id}`}
                              className="flex-1 min-w-0 cursor-pointer"
                            >
                              <p className="text-sm text-charcoal truncate">
                                {product.product_name ?? product.external_product_id}
                              </p>
                              {product.product_name && (
                                <p className="text-xs text-slate truncate">
                                  {product.external_product_id}
                                  {productAlreadyCovered && ' — already nominated'}
                                  {!productAlreadyCovered && inheritedFromSelectedClass && ' — covered by selected class'}
                                </p>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 bg-white text-charcoal border border-slate/20 text-sm font-medium py-2.5 rounded-lg hover:bg-light-gray transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onAdvance}
          disabled={!canContinue}
          className="flex-1 bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-charcoal transition-colors disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
