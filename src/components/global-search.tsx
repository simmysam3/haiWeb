'use client';

import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  SearchCounterpartyHit,
  SearchResponse,
  SearchScopeHit,
  SearchSkuHit,
} from '@haiwave/protocol';
import { Pill } from '@/components/pill';
import { jsonFetcher, FetchError } from '@/lib/swr-fetcher';

/**
 * GlobalSearch — top-nav unified search input.
 *
 * Calls /api/search?q=... (BFF) debounced at 250ms after the user types at
 * least 2 characters. Returns a dropdown with three categorized sections
 * (Counterparties / SKUs / Scopes), up to 5 results each. Each row carries
 * a Pill state badge and clicks through to the appropriate detail page.
 *
 * Bypass-state contract is honored end-to-end: archived/declined/withdrawn
 * rows ARE surfaced in the dropdown when they match the query. That is the
 * whole point of having a search surface separate from the per-page list
 * views.
 *
 * Keyboard nav: ↑/↓ to walk the dropdown, Enter to navigate, Esc to close.
 * Footer link goes to the full results page at /account/search?q=...
 */

const DEBOUNCE_MS = 250;
const MIN_QUERY_LEN = 2;
const PER_CATEGORY_LIMIT = 5;

type FlatRow =
  | { kind: 'counterparty'; href: string; hit: SearchCounterpartyHit }
  | { kind: 'sku'; href: string; hit: SearchSkuHit }
  | { kind: 'scope'; href: string; hit: SearchScopeHit };

function counterpartyHref(c: SearchCounterpartyHit): string {
  return `/account/partners/${c.participant_id}`;
}

function skuHref(s: SearchSkuHit): string {
  // The Working List is the canonical home for SKU-scoped state. Filter the
  // working list to this product_id; the page itself is responsible for
  // honoring the `sku` query param (deferred — currently the page may not
  // wire this filter yet; route lands the user in the right surface either
  // way).
  return `/account/sonar/audit/gaps?sku=${encodeURIComponent(s.product_id)}`;
}

function scopeHref(s: SearchScopeHit): string {
  // The Request Management surface has no per-scope detail page today; we
  // deep-link to the list with a scope_id query so the row scrolls into
  // view (or the user filters to it). Resolves to the right surface even
  // before that filter is plumbed.
  return `/account/sonar/requests?scope_id=${encodeURIComponent(s.scope_id)}`;
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce the query before firing the fetch.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  // Fetch on debounced query change.
  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LEN) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const url = `/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=${PER_CATEGORY_LIMIT}`;
    jsonFetcher<SearchResponse>(url)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setHighlightedIndex(-1);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof FetchError) {
          setError(`Search failed (${err.status})`);
        } else {
          setError('Search failed');
        }
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Flatten the result categories into a single navigable list for
  // keyboard handling.
  const flat: FlatRow[] = useMemo(() => {
    if (!data) return [];
    const out: FlatRow[] = [];
    for (const c of data.counterparties) {
      out.push({ kind: 'counterparty', href: counterpartyHref(c), hit: c });
    }
    for (const s of data.skus) {
      out.push({ kind: 'sku', href: skuHref(s), hit: s });
    }
    for (const s of data.scopes) {
      out.push({ kind: 'scope', href: scopeHref(s), hit: s });
    }
    return out;
  }, [data]);

  const navigateToFullPage = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LEN) return;
    router.push(`/account/search?q=${encodeURIComponent(trimmed)}`);
    setIsOpen(false);
  }, [query, router]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((i) => Math.min(i + 1, flat.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && flat[highlightedIndex]) {
        router.push(flat[highlightedIndex].href);
        setIsOpen(false);
        return;
      }
      // No row selected — go to the full results page.
      navigateToFullPage();
    }
  }

  const showDropdown = Boolean(
    isOpen && (debouncedQuery.length >= MIN_QUERY_LEN || isLoading || error),
  );
  const showEmpty =
    isOpen &&
    debouncedQuery.length >= MIN_QUERY_LEN &&
    !isLoading &&
    !error &&
    data !== null &&
    flat.length === 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <label htmlFor="global-search-input" className="sr-only">
        Search
      </label>
      <input
        id="global-search-input"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={onKeyDown}
        // v.1.37 mobile pass: touch-target height ≥44px on mobile via
        // `py-2.5` (WCAG AA), tighter on ≥md to match desktop. The placeholder
        // stays descriptive — a plain string can't be made responsive, and the
        // browser truncates any overflow in the narrower mobile input.
        placeholder="Search counterparties, SKUs, scopes…"
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-md border border-slate/30 bg-white px-3 py-2.5 text-base text-navy placeholder:text-slate focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30 md:py-1.5 md:text-sm md:placeholder:text-slate"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls="global-search-listbox"
      />

      {showDropdown && (
        <div
          id="global-search-listbox"
          role="listbox"
          // v.1.37 mobile pass: shorter max-height on small screens so the
          // dropdown doesn't extend past the viewport on phones with a
          // visible keyboard. Desktop keeps the original 480px ceiling.
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-md border border-slate/20 bg-white shadow-lg md:max-h-[480px]"
        >
          {isLoading && (
            <div className="px-4 py-3 text-sm text-slate">Searching…</div>
          )}
          {error && (
            <div className="px-4 py-3 text-sm text-problem">{error}</div>
          )}
          {showEmpty && (
            <div className="px-4 py-3 text-sm text-slate">
              No results for {`"${debouncedQuery}"`}.
            </div>
          )}

          {data && flat.length > 0 && (
            <ResultDropdown
              data={data}
              flat={flat}
              highlightedIndex={highlightedIndex}
              setHighlightedIndex={setHighlightedIndex}
              onSelect={() => setIsOpen(false)}
            />
          )}

          {debouncedQuery.length >= MIN_QUERY_LEN && (
            <button
              type="button"
              onClick={navigateToFullPage}
              // v.1.37 mobile pass: ≥44px touch target on mobile.
              className="block w-full border-t border-slate/10 bg-light-gray px-4 py-3 text-left text-xs font-medium text-teal-dark hover:bg-teal/10 md:py-2"
            >
              See all results for {`"${debouncedQuery}"`} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ResultDropdownProps {
  data: SearchResponse;
  flat: FlatRow[];
  highlightedIndex: number;
  setHighlightedIndex: (i: number) => void;
  onSelect: () => void;
}

function ResultDropdown({
  data,
  flat,
  highlightedIndex,
  setHighlightedIndex,
  onSelect,
}: ResultDropdownProps) {
  // Walk the flat array in slices so the per-section rendering aligns with
  // keyboard indexes.
  let cursor = 0;

  const counterpartySlice = flat.slice(
    cursor,
    cursor + data.counterparties.length,
  );
  cursor += data.counterparties.length;
  const skuSlice = flat.slice(cursor, cursor + data.skus.length);
  cursor += data.skus.length;
  const scopeSlice = flat.slice(cursor, cursor + data.scopes.length);

  return (
    <>
      {data.counterparties.length > 0 && (
        <SearchSection
          label="Counterparties"
          rows={counterpartySlice}
          startIndex={0}
          highlightedIndex={highlightedIndex}
          setHighlightedIndex={setHighlightedIndex}
          onSelect={onSelect}
        />
      )}
      {data.skus.length > 0 && (
        <SearchSection
          label="SKUs"
          rows={skuSlice}
          startIndex={data.counterparties.length}
          highlightedIndex={highlightedIndex}
          setHighlightedIndex={setHighlightedIndex}
          onSelect={onSelect}
        />
      )}
      {data.scopes.length > 0 && (
        <SearchSection
          label="Scopes / Requests"
          rows={scopeSlice}
          startIndex={data.counterparties.length + data.skus.length}
          highlightedIndex={highlightedIndex}
          setHighlightedIndex={setHighlightedIndex}
          onSelect={onSelect}
        />
      )}
    </>
  );
}

interface SearchSectionProps {
  label: string;
  rows: FlatRow[];
  startIndex: number;
  highlightedIndex: number;
  setHighlightedIndex: (i: number) => void;
  onSelect: () => void;
}

function SearchSection({
  label,
  rows,
  startIndex,
  highlightedIndex,
  setHighlightedIndex,
  onSelect,
}: SearchSectionProps) {
  return (
    <div>
      <div className="border-b border-slate/10 bg-light-gray px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate">
        {label}
      </div>
      <ul>
        {rows.map((row, i) => {
          const flatIndex = startIndex + i;
          const isHighlighted = flatIndex === highlightedIndex;
          return (
            <li key={`${row.kind}-${flatIndex}`}>
              <Link
                href={row.href}
                onClick={onSelect}
                onMouseEnter={() => setHighlightedIndex(flatIndex)}
                role="option"
                aria-selected={isHighlighted}
                // v.1.37 mobile pass: per-row tap target ≥44px on mobile
                // via `py-3`, tighter on ≥md to match the original density.
                // Row stacks label/badge on mobile to avoid the pill
                // wrapping under truncated text.
                className={`flex flex-col items-start gap-1 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between md:gap-2 md:py-2 ${
                  isHighlighted ? 'bg-teal/10' : 'hover:bg-light-gray'
                }`}
              >
                <SearchRowLabel row={row} />
                <SearchRowBadge row={row} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SearchRowLabel({ row }: { row: FlatRow }) {
  if (row.kind === 'counterparty') {
    const c = row.hit;
    return (
      <span className="truncate text-navy">
        {c.legal_name}
        {c.dba_name && (
          <span className="ml-2 text-xs text-slate">(dba {c.dba_name})</span>
        )}
      </span>
    );
  }
  if (row.kind === 'sku') {
    const s = row.hit;
    return (
      <span className="truncate text-navy">
        {s.sku_label}
        <span className="ml-2 text-xs text-slate">
          {s.product_id}
          {s.responder_legal_name ? ` · ${s.responder_legal_name}` : ''}
        </span>
      </span>
    );
  }
  const sc = row.hit;
  return (
    <span className="truncate text-navy">
      {sc.subject}
      <span className="ml-2 text-xs text-slate">
        {sc.scope_type}
        {sc.counterparty_legal_name ? ` · ${sc.counterparty_legal_name}` : ''}
      </span>
    </span>
  );
}

function SearchRowBadge({ row }: { row: FlatRow }) {
  if (row.kind === 'counterparty') {
    return <Pill category="status" value={row.hit.status} />;
  }
  if (row.kind === 'sku') {
    return <Pill category="status" value={row.hit.status} />;
  }
  return <Pill category="status" value={row.hit.acceptance_status} />;
}
