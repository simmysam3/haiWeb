'use client';

import { useEffect, useMemo, useState } from 'react';

interface CatalogProduct {
  external_product_id: string;
  product_name: string | null;
  primary_class_slug: string | null;
}

interface Props {
  counterpartyId: string;
  value: string[];
  onChange: (skus: string[]) => void;
}

const PAGE_SIZE = 500;

export function PartnerSkuPicker({ counterpartyId, value, onChange }: Props) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [addNotice, setAddNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!counterpartyId) {
      setProducts([]);
      setTotal(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProducts([]);
    setTotal(0);
    (async () => {
      try {
        const res = await fetch(
          `/api/account/partners/${encodeURIComponent(counterpartyId)}/catalog/products?page=1&size=${PAGE_SIZE}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { products: CatalogProduct[]; total: number };
        if (!cancelled) {
          setProducts(body.products ?? []);
          setTotal(body.total ?? 0);
        }
      } catch {
        if (!cancelled) setError("Couldn't load this partner's catalog.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [counterpartyId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.external_product_id.toLowerCase().includes(q));
  }, [products, query]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  if (!counterpartyId) {
    return (
      <p className="text-sm text-slate italic">
        Select a counterparty first to choose SKUs from its catalog.
      </p>
    );
  }

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(value.filter((s) => s !== id));
    else onChange([...value, id]);
  }

  function addDraft() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft('');
      return;
    }
    if (selectedSet.has(trimmed)) {
      setAddNotice('Already selected.');
      setDraft('');
      return;
    }
    onChange([...value, trimmed]);
    setAddNotice(null);
    setDraft('');
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded bg-teal/10 px-2 py-0.5 text-xs text-teal-dark"
            >
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => onChange(value.filter((x) => x !== s))}
                className="text-teal hover:text-problem"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Filter this partner's catalog"
        placeholder="Filter this partner's catalog…"
        className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
      />

      {loading && <p className="text-xs text-slate italic">Loading catalog…</p>}
      {error && <p className="text-xs text-problem">{error}</p>}
      {!loading && !error && (
        <>
          {total > PAGE_SIZE && (
            <p className="text-xs text-slate italic">
              Showing the first {PAGE_SIZE} of {total}. Use the filter to narrow.
            </p>
          )}
          {filtered.length === 0 ? (
            <p className="text-sm text-slate italic">
              No matching products. Add a SKU by id below.
            </p>
          ) : (
            <ul aria-label="Partner catalog" className="border border-slate/20 rounded-lg divide-y divide-slate/10 max-h-60 overflow-y-auto">
              {filtered.map((p) => {
                const checked = selectedSet.has(p.external_product_id);
                return (
                  <li key={p.external_product_id} className="flex items-center gap-3 px-4 py-2">
                    <input
                      id={`sku-${p.external_product_id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.external_product_id)}
                      className="h-4 w-4 accent-teal"
                    />
                    <label
                      htmlFor={`sku-${p.external_product_id}`}
                      className="flex-1 min-w-0 cursor-pointer text-sm text-charcoal truncate"
                    >
                      {p.external_product_id}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setAddNotice(null); }}
          aria-label="SKU I have in mind"
          placeholder="SKU I have in mind…"
          className="flex-1 px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        />
        <button
          type="button"
          onClick={addDraft}
          className="rounded bg-navy text-white px-3 py-2 text-sm font-medium hover:bg-charcoal"
        >
          Add
        </button>
      </div>
      {addNotice && <p className="text-xs text-problem">{addNotice}</p>}
    </div>
  );
}
