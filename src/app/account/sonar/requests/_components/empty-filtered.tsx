'use client';

import { useRouter, usePathname } from 'next/navigation';

/**
 * v.1.37 Request Management — empty state when active filters reduce the
 * list to zero rows. Distinct from the "no items at all" empty state in
 * `request-list.tsx` (which is the genuine zero-inventory case).
 *
 * The Clear-filters CTA pushes the bare pathname, which drops every
 * `?…` filter param at once — equivalent to FilterBar's "Clear all filters"
 * link. Direction tab selection lives in the same URL so it also resets to
 * the default `me` tab.
 */
export function EmptyFiltered() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="rounded-lg border border-slate/15 bg-white p-12 text-center">
      <p className="text-sm text-slate">No items match your filters.</p>
      <button
        type="button"
        onClick={() => router.push(pathname)}
        className="mt-3 text-sm text-teal underline hover:text-navy"
      >
        Clear filters
      </button>
    </div>
  );
}
