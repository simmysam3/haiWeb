'use client';
import { useState, useEffect } from 'react';

interface SkuHit {
  sku: string;
  label: string;
}

interface SkuAutocompleteProps {
  value: string;
  onChange: (sku: string) => void;
  fetcher: (q: string) => Promise<SkuHit[]>;
  placeholder?: string;
}

export function SkuAutocomplete({ value, onChange, fetcher, placeholder }: SkuAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [hits, setHits] = useState<SkuHit[]>([]);

  useEffect(() => {
    if (query.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    fetcher(query).then((rows) => {
      if (!cancelled) setHits(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [query, fetcher]);

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={hits.length > 0}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? 'Type a SKU...'}
        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
      />
      {hits.length > 0 && (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white shadow">
          {hits.map((hit) => (
            <li
              key={hit.sku}
              onClick={() => {
                onChange(hit.sku);
                setQuery(hit.sku);
                setHits([]);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span className="font-mono text-slate-900">{hit.sku}</span>
              <span className="ml-2 text-slate-500">{hit.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
