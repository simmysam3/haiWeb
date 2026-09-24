'use client';
import type { VariantAxis } from '@/lib/sourcing-map/contract';

/** Per-variant quantity table for a size-bound line (spec §6.1 qty_by_variant; §7.2). */
export function SizeTable({ axis, qtyPerUnit, value, onChange }: {
  axis: VariantAxis; qtyPerUnit: number; value: Record<string, number> | null; onChange(v: Record<string, number> | null): void;
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
      <button type="button" className="sm-link mt-2 text-xs" onClick={() => onChange(null)}>Use the uniform qty for every size</button>
    </div>
  );
}
