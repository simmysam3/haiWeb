'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { RunsFilter } from './runs-filter';

interface RunsFilterToggleProps {
  value: RunsFilter;
}

const OPTIONS: Array<{ value: RunsFilter; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

/**
 * v1.85 (D-206) — Active | Archived toggle for a definition page's Run
 * history tab. Archived runs (a watcher/audit definition deleted with
 * runs=archive) are hidden from the default list; this flips `?runs=archived`
 * to show them, preserving every other query param (e.g. `tab=`).
 *
 * Styled like the definition-page tab bar's active chip (SectionTabs), but
 * implemented as a labelled radiogroup rather than a tablist — Active vs.
 * Archived filters the one Run history panel, it doesn't switch panels.
 */
export function RunsFilterToggle({ value }: RunsFilterToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: RunsFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'archived') {
      params.set('runs', 'archived');
    } else {
      params.delete('runs');
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Runs"
      className="inline-flex rounded border border-slate/20 overflow-hidden text-xs"
    >
      {OPTIONS.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className={`cursor-pointer px-3 py-1.5 font-medium transition-colors ${
              checked ? 'bg-teal/10 text-teal-dark' : 'text-slate hover:text-charcoal'
            }`}
          >
            <input
              type="radio"
              name="runs-filter"
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
