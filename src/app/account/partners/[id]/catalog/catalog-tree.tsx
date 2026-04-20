'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuditScope, AuditScopeCoverage } from '@haiwave/protocol';
import type { CatalogClass, CatalogProduct } from '@/lib/haiwave-api';

interface ProductsState {
  loading: boolean;
  loaded: boolean;
  products: CatalogProduct[];
  total: number;
  error?: string;
}

export function CatalogTree({ vendorId }: { vendorId: string }) {
  const [classes, setClasses] = useState<CatalogClass[]>([]);
  const [coverage, setCoverage] = useState<AuditScopeCoverage | null>(null);
  const [scopes, setScopes] = useState<AuditScope[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [products, setProducts] = useState<Record<string, ProductsState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const refreshCoverage = useCallback(async () => {
    try {
      const [covRes, scopesRes] = await Promise.all([
        fetch(`/api/account/audit-coverage?vendor_id=${encodeURIComponent(vendorId)}`),
        fetch(
          `/api/account/audit-scopes?vendor_id=${encodeURIComponent(vendorId)}&active_only=true`,
        ),
      ]);
      if (!covRes.ok) throw new Error(`Failed to load coverage (${covRes.status})`);
      if (!scopesRes.ok) throw new Error(`Failed to load scopes (${scopesRes.status})`);
      const cov = (await covRes.json()) as AuditScopeCoverage;
      const scopesBody = (await scopesRes.json()) as { scopes: AuditScope[] };
      setCoverage(cov);
      setScopes(scopesBody.scopes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh coverage');
    }
  }, [vendorId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [classesRes, covRes, scopesRes] = await Promise.all([
          fetch(`/api/account/partners/${encodeURIComponent(vendorId)}/catalog/classes`),
          fetch(`/api/account/audit-coverage?vendor_id=${encodeURIComponent(vendorId)}`),
          fetch(
            `/api/account/audit-scopes?vendor_id=${encodeURIComponent(vendorId)}&active_only=true`,
          ),
        ]);
        if (!classesRes.ok) throw new Error(`Failed to load classes (${classesRes.status})`);
        if (!covRes.ok) throw new Error(`Failed to load coverage (${covRes.status})`);
        if (!scopesRes.ok) throw new Error(`Failed to load scopes (${scopesRes.status})`);

        const classesBody = (await classesRes.json()) as { classes: CatalogClass[] };
        const cov = (await covRes.json()) as AuditScopeCoverage;
        const scopesBody = (await scopesRes.json()) as { scopes: AuditScope[] };

        if (cancelled) return;
        setClasses(classesBody.classes ?? []);
        setCoverage(cov);
        setScopes(scopesBody.scopes ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load catalog');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const findScope = useCallback(
    (scopeType: 'company' | 'class' | 'product', scopeRef: string | null) => {
      return scopes.find(
        (s) =>
          s.disabled_at === null &&
          s.scope_type === scopeType &&
          (s.scope_ref ?? null) === scopeRef,
      );
    },
    [scopes],
  );

  const createScope = useCallback(
    async (body: {
      vendor_participant_id: string;
      scope_type: 'company' | 'class' | 'product';
      scope_ref?: string;
    }) => {
      setMutating(true);
      setError(null);
      try {
        const res = await fetch('/api/account/audit-scopes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Failed to create scope (${res.status})`);
        await refreshCoverage();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create scope');
      } finally {
        setMutating(false);
      }
    },
    [refreshCoverage],
  );

  const deleteScope = useCallback(
    async (scopeId: string) => {
      setMutating(true);
      setError(null);
      try {
        const res = await fetch(`/api/account/audit-scopes/${encodeURIComponent(scopeId)}`, {
          method: 'DELETE',
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`Failed to delete scope (${res.status})`);
        }
        await refreshCoverage();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete scope');
      } finally {
        setMutating(false);
      }
    },
    [refreshCoverage],
  );

  const onToggleCompany = useCallback(async () => {
    if (!coverage) return;
    if (coverage.company) {
      const scope = findScope('company', null);
      if (scope) await deleteScope(scope.scope_id);
    } else {
      await createScope({
        vendor_participant_id: vendorId,
        scope_type: 'company',
      });
    }
  }, [coverage, findScope, deleteScope, createScope, vendorId]);

  const onToggleClass = useCallback(
    async (klass: CatalogClass) => {
      if (!coverage) return;
      const current = coverage.classes[klass.class_id] ?? false;
      if (current) {
        const scope = findScope('class', klass.class_id);
        if (scope) await deleteScope(scope.scope_id);
      } else {
        await createScope({
          vendor_participant_id: vendorId,
          scope_type: 'class',
          scope_ref: klass.class_id,
        });
      }
    },
    [coverage, findScope, deleteScope, createScope, vendorId],
  );

  const onToggleProduct = useCallback(
    async (product: CatalogProduct) => {
      if (!coverage) return;
      const current = coverage.products[product.external_product_id] ?? false;
      if (current) {
        const scope = findScope('product', product.external_product_id);
        if (scope) await deleteScope(scope.scope_id);
      } else {
        await createScope({
          vendor_participant_id: vendorId,
          scope_type: 'product',
          scope_ref: product.external_product_id,
        });
      }
    },
    [coverage, findScope, deleteScope, createScope, vendorId],
  );

  const loadProductsForClass = useCallback(
    async (klass: CatalogClass) => {
      const classId = klass.class_id;
      setProducts((prev) => ({
        ...prev,
        [classId]: {
          loading: true,
          loaded: prev[classId]?.loaded ?? false,
          products: prev[classId]?.products ?? [],
          total: prev[classId]?.total ?? 0,
        },
      }));
      try {
        const res = await fetch(
          `/api/account/partners/${encodeURIComponent(vendorId)}/catalog/products?class_id=${encodeURIComponent(classId)}&page=1&size=500`,
        );
        if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
        const body = (await res.json()) as { products: CatalogProduct[]; total: number };
        setProducts((prev) => ({
          ...prev,
          [classId]: {
            loading: false,
            loaded: true,
            products: body.products ?? [],
            total: body.total ?? 0,
          },
        }));
      } catch (e) {
        setProducts((prev) => ({
          ...prev,
          [classId]: {
            loading: false,
            loaded: false,
            products: [],
            total: 0,
            error: e instanceof Error ? e.message : 'Failed to load products',
          },
        }));
      }
    },
    [vendorId],
  );

  const onToggleExpand = useCallback(
    async (klass: CatalogClass) => {
      const classId = klass.class_id;
      const willExpand = !expanded[classId];
      setExpanded((prev) => ({ ...prev, [classId]: willExpand }));
      if (willExpand && !products[classId]?.loaded && !products[classId]?.loading) {
        await loadProductsForClass(klass);
      }
    },
    [expanded, products, loadProductsForClass],
  );

  const companyChecked = coverage?.company ?? false;

  const summary = useMemo(() => {
    if (!coverage) return null;
    if (coverage.company) return 'Company-wide audit scope active.';
    const classCount = Object.values(coverage.classes).filter(Boolean).length;
    const productCount = Object.values(coverage.products).filter(Boolean).length;
    if (classCount === 0 && productCount === 0) return 'No audit scope configured.';
    const parts: string[] = [];
    if (classCount > 0) parts.push(`${classCount} class${classCount === 1 ? '' : 'es'}`);
    if (productCount > 0) parts.push(`${productCount} product${productCount === 1 ? '' : 's'}`);
    return `Audit scope: ${parts.join(' + ')}.`;
  }, [coverage]);

  if (loading) {
    return <div className="text-sm text-slate italic">Loading catalog&hellip;</div>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded border border-problem/30 bg-problem/5 px-3 py-2 text-sm text-problem">
          {error}
        </div>
      )}

      {summary && (
        <div className="text-xs text-slate uppercase tracking-wider">{summary}</div>
      )}

      {/* Company-level row */}
      <div className="rounded border border-slate/20 bg-white">
        <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={companyChecked}
            onChange={onToggleCompany}
            disabled={mutating}
            className="h-4 w-4 accent-teal"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-charcoal">Entire company</p>
            <p className="text-xs text-slate">
              Audit every class and product this vendor offers, now and in the future.
            </p>
          </div>
        </label>
      </div>

      {/* Classes */}
      {classes.length === 0 ? (
        <div className="rounded border border-slate/20 bg-light-gray px-4 py-6 text-sm text-slate text-center">
          No classes found for this vendor.
        </div>
      ) : (
        <div className="rounded border border-slate/20 bg-white divide-y divide-slate/10">
          {classes.map((klass) => {
            const inheritFromCompany = companyChecked;
            const classChecked = inheritFromCompany
              ? true
              : coverage?.classes[klass.class_id] ?? false;
            const classDisabled = mutating || inheritFromCompany;
            const isExpanded = !!expanded[klass.class_id];
            const productsState = products[klass.class_id];

            return (
              <div key={klass.class_id}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 ${
                    inheritFromCompany ? 'opacity-60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={classChecked}
                    disabled={classDisabled}
                    onChange={() => onToggleClass(klass)}
                    className="h-4 w-4 accent-teal"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-charcoal">
                      {klass.class_name}
                    </p>
                    <p className="text-xs text-slate">
                      {klass.class_slug} &middot; {klass.product_count} product
                      {klass.product_count === 1 ? '' : 's'}
                      {inheritFromCompany && ' — covered by company scope'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleExpand(klass)}
                    className="text-xs text-teal hover:text-teal-dark font-medium"
                  >
                    {isExpanded ? 'Hide products' : 'Show products'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="bg-light-gray px-4 py-3 border-t border-slate/10">
                    {productsState?.loading && (
                      <p className="text-xs text-slate italic">Loading products&hellip;</p>
                    )}
                    {productsState?.error && (
                      <p className="text-xs text-problem">{productsState.error}</p>
                    )}
                    {productsState?.loaded && productsState.products.length === 0 && (
                      <p className="text-xs text-slate italic">No products in this class.</p>
                    )}
                    {productsState?.loaded && productsState.products.length > 0 && (
                      <ul className="space-y-1">
                        {productsState.products.map((product) => {
                          const inheritFromClass =
                            inheritFromCompany ||
                            (coverage?.classes[klass.class_id] ?? false);
                          const productChecked = inheritFromClass
                            ? true
                            : coverage?.products[product.external_product_id] ?? false;
                          const productDisabled = mutating || inheritFromClass;
                          return (
                            <li
                              key={product.external_product_id}
                              className={`flex items-center gap-3 pl-6 py-1.5 ${
                                inheritFromClass ? 'opacity-60' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={productChecked}
                                disabled={productDisabled}
                                onChange={() => onToggleProduct(product)}
                                className="h-4 w-4 accent-teal"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-charcoal truncate">
                                  {product.product_name ?? product.external_product_id}
                                </p>
                                {product.product_name && (
                                  <p className="text-xs text-slate truncate">
                                    {product.external_product_id}
                                  </p>
                                )}
                              </div>
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
      )}
    </div>
  );
}
