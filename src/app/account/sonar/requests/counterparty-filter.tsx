'use client';

import { useMemo } from 'react';
import type { RequestManagementItem } from '@haiwave/protocol';

/**
 * v1.35 Request Management — counterparty dropdown filter.
 *
 * Presentational only: state is owned by Task 25's RequestManagementClient.
 * Derives the option list at render time from `items`, which MUST be an
 * UNFILTERED list (typically a separate `awaiting=all&type=all` fetch in the
 * orchestrator) so the option set doesn't self-prune when a counterparty is
 * selected and the user can switch directly between counterparties.
 * Selecting "All counterparties" emits `null`.
 *
 * Falls back to the (truncated) counterparty UUID when `counterparty_legal_name`
 * is null on the protocol DTO — sort order keys on the visible label so the
 * dropdown stays alphabetical with mixed named/unnamed counterparties.
 *
 * Belt-and-suspenders: if the active `value` isn't present in the derived
 * options (e.g. the unfiltered fetch is still in flight, or the counterparty
 * has just stopped appearing in any request), a synthetic "(no longer visible)"
 * option is rendered for it so the `<select>` doesn't silently fall back to
 * "All counterparties" while state still holds the stale ID.
 *
 * Styling mirrors the v1.34 working-list status/sort dropdowns
 * (`posture/working-list/filter-pills.tsx`): slate/30 border, rounded-md,
 * small text, with a `title=` tooltip explaining the filter action.
 */

interface CounterpartyFilterProps {
  items: RequestManagementItem[];
  value: string | null;
  onChange: (v: string | null) => void;
}

interface CounterpartyOption {
  id: string;
  label: string;
}

export function CounterpartyFilter({ items, value, onChange }: CounterpartyFilterProps) {
  const options = useMemo<CounterpartyOption[]>(() => {
    const byId = new Map<string, CounterpartyOption>();
    for (const item of items) {
      if (byId.has(item.counterparty_id)) continue;
      const label = item.counterparty_legal_name ?? item.counterparty_id;
      byId.set(item.counterparty_id, { id: item.counterparty_id, label });
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    );
  }, [items]);

  // Phantom-value guard: if the active selection isn't in the derived option
  // list, render a placeholder <option> for it so the <select> truthfully
  // reflects the active filter instead of visually falling back to "All".
  const hasActiveOption = value !== null && options.some((o) => o.id === value);
  const showPhantomOption = value !== null && !hasActiveOption;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="self-center text-xs uppercase tracking-wider text-slate">Counterparty:</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        title="Filter the list to requests involving a single counterparty. Choose 'All counterparties' to clear."
        className="rounded-md border border-slate/30 px-2 py-1 text-xs"
      >
        <option value="">All counterparties</option>
        {showPhantomOption && value !== null && (
          <option value={value}>(no longer visible)</option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
