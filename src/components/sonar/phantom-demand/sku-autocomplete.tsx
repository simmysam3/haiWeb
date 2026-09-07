'use client';
import { useState, useEffect, useId } from 'react';

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
  // Keyboard cursor over the suggestions; -1 = none (typing continues).
  const [active, setActive] = useState(-1);
  const listId = useId();
  const optionId = (i: number) => `${listId}-option-${i}`;

  function pick(hit: SkuHit) {
    onChange(hit.sku);
    setQuery(hit.sku);
    setHits([]);
    setActive(-1);
  }

  useEffect(() => {
    if (query.length < 2) return; // the input handler already cleared the list
    let cancelled = false;
    fetcher(query).then((rows) => {
      if (!cancelled) {
        setHits(rows);
        setActive(-1);
      }
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
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        value={query}
        onChange={(e) => {
          // What is typed IS the value: a SKU the fetcher does not know (past
          // the suggestions it can offer) must still reach the form.
          const next = e.target.value;
          setQuery(next);
          onChange(next);
          if (next.length < 2) {
            setHits([]);
            setActive(-1);
          }
        }}
        onKeyDown={(e) => {
          if (hits.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, hits.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, -1));
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault(); // the pick, not a form submit
            pick(hits[active]);
          } else if (e.key === 'Escape') {
            setHits([]);
            setActive(-1);
          }
        }}
        placeholder={placeholder ?? 'Type a SKU...'}
        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
      />
      {hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white shadow"
        >
          {hits.map((hit, i) => (
            <li
              key={hit.sku}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onClick={() => pick(hit)}
              className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-50${i === active ? ' bg-slate-100' : ''}`}
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
