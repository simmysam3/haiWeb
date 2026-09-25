'use client';
import type { VariantAxis } from '@/lib/sourcing-map/contract';
import { SmButton } from '../../../../_components/sm-button';

/** Per-variant quantity table for a size-bound line (spec §6.1 qty_by_variant; §7.2). */
export function SizeTable({ axis, qtyPerUnit, value, onChange, locked = false }: {
  axis: VariantAxis; qtyPerUnit: number; value: Record<string, number> | null; onChange(v: Record<string, number> | null): void;
  /** stale-lock: the grid is read-only. */
  locked?: boolean;
}) {
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {axis.values.map((v) => (
          <label key={v} className="flex flex-col text-xs">
            <span className="sm-muted">{v}</span>
            <input
              type="number"
              step="any"
              min={0}
              aria-label={`Qty for size ${v}`}
              className="sm-input w-16 text-xs"
              readOnly={locked}
              value={value?.[v] ?? qtyPerUnit}
              onChange={(e) => {
                const n = Number.parseFloat(e.target.value);
                if (!Number.isFinite(n) || n < 0) return;
                onChange({ ...(value ?? {}), [v]: n });
              }}
            />
          </label>
        ))}
      </div>
      <SmButton className="sm-link mt-2 text-xs" aria-disabled={locked} onClick={() => onChange(null)}>Use the uniform qty for every size</SmButton>
    </div>
  );
}
