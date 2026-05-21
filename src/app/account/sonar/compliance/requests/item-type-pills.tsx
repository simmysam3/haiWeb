'use client';

/**
 * v1.35 Request Management — item-type filter pills.
 *
 * Presentational toggle strip. State is owned by Task 25's
 * RequestManagementClient orchestrator (this component just renders `value`
 * and emits `onChange`). Three exclusive values: `all`, `nomination`,
 * `obligation`. The collapse from the protocol's three raw item types
 * (`inbound_nomination` / `outbound_nomination` / `inbound_obligation`)
 * onto the UX-facing 2-bucket filter happens in the orchestrator — this
 * component is intentionally type-agnostic about that mapping.
 *
 * Styling + interaction pattern mirror the v1.34 working-list / changes
 * filter pills (`posture/working-list/filter-pills.tsx`,
 * `posture/changes/filter-pills.tsx`): pill-shaped `<button>` toggles with
 * teal/10 active state, slate hover, `aria-pressed` for screen readers, and
 * `title=` tooltips that lead with a definition then describe the click
 * action. Per CLAUDE.md, filter pills (toggleable category selectors) are a
 * separate primitive from the value-bound `<Pill>` status component — these
 * stay inline `<button>` elements like every other filter-pill surface.
 */

export type ItemTypePillValue = 'all' | 'nomination' | 'obligation';

interface ItemTypePillsProps {
  value: ItemTypePillValue;
  onChange: (v: ItemTypePillValue) => void;
}

const PILLS: { key: ItemTypePillValue; label: string; tooltip: string }[] = [
  {
    key: 'all',
    label: 'All types',
    tooltip: 'Show both nominations and obligations. Click to clear the type filter.',
  },
  {
    key: 'nomination',
    label: 'Nominations',
    tooltip:
      'Audit-scope requests — outbound (you nominated a vendor) or inbound (a customer nominated you). Click to filter the list to nominations only.',
  },
  {
    key: 'obligation',
    label: 'Obligations',
    tooltip:
      'Per-SKU response obligations cascaded down after a nomination was accepted. Click to filter the list to obligations only.',
  },
];

export function ItemTypePills({ value, onChange }: ItemTypePillsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="self-center text-xs uppercase tracking-wider text-slate">Type:</span>
      {PILLS.map((p) => {
        const active = value === p.key;
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={active}
            title={p.tooltip}
            onClick={() => onChange(p.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              active
                ? 'border-teal bg-teal/10 text-navy'
                : 'border-slate/30 text-slate hover:border-slate'
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
